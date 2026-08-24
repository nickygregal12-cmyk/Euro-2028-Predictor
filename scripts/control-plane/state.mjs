/**
 * Durable control-plane state.
 *
 * This is scheduling state, not repository truth. It records what the loop is
 * doing and what it observed; it never becomes a second place where project
 * facts live. Where a project fact is needed, store an authority pointer
 * (a repo path) and re-read it — a copied value goes stale silently.
 *
 * Deliberately plain JSON + JSONL under a state directory outside the git tree:
 * it is disposable, inspectable with `cat`, and needs no native dependency.
 */

import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

import { DEFAULT_LIMITS, TASK_STATES, RUN_MODES } from './policy.mjs'

/**
 * @typedef {import('./policy.mjs').Task} Task
 * @typedef {import('./policy.mjs').Run} Run
 * @typedef {import('./policy.mjs').TaskState} TaskState
 */

export function stateDir() {
  return (
    process.env.PREDICTOR_CONTROL_STATE_DIR ??
    join(homedir(), '.local', 'state', 'predictor-control')
  )
}

const RUN_FILE = 'run.json'
const TASKS_FILE = 'tasks.json'
const CHECKPOINTS_FILE = 'checkpoints.json'
const EVENTS_FILE = 'events.jsonl'
const LEASE_FILE = 'lease.json'

/**
 * Never store anything shaped like a credential. This is a backstop, not an
 * excuse to pass secrets in: callers must not put them in records at all.
 */
const SECRET_KEY = /(token|secret|password|apikey|api_key|authorization|private_key|credential)/i

/**
 * @param {any} record
 * @param {string} [path]
 */
export function assertNoSecrets(record, path = 'record') {
  if (record === null || typeof record !== 'object') return record
  for (const [key, value] of Object.entries(record)) {
    if (SECRET_KEY.test(key)) {
      throw new Error(`refusing to persist secret-shaped key at ${path}.${key}`)
    }
    assertNoSecrets(value, `${path}.${key}`)
  }
  return record
}

/**
 * @param {string} dir
 * @param {string} file
 * @param {any} fallback
 */
function readJson(dir, file, fallback) {
  const target = join(dir, file)
  // Read and handle absence, rather than asking first: the state directory is
  // shared with other processes holding the lease, so a file can vanish between
  // an existence check and the read that trusted it.
  try {
    return JSON.parse(readFileSync(target, 'utf8'))
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error)?.code === 'ENOENT') return fallback
    throw error
  }
}

/**
 * Write-then-rename so a crash mid-write cannot leave a half-parsed ledger.
 *
 * @param {string} dir
 * @param {string} file
 * @param {any} value
 */
function writeJson(dir, file, value) {
  assertNoSecrets(value, file)
  mkdirSync(dir, { recursive: true })
  const target = join(dir, file)
  const tmp = `${target}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(tmp, target)
}

export class ControlPlaneStore {
  /** @param {string} [dir] */
  constructor(dir = stateDir()) {
    this.dir = dir
    mkdirSync(this.dir, { recursive: true })
  }

  // ---- RUN ---------------------------------------------------------------

  /** @returns {Run | null} */
  loadRun() {
    return readJson(this.dir, RUN_FILE, null)
  }

  /**
   * Idempotent: an existing run is returned untouched so a restart resumes it.
   *
   * @param {{ hardStop: string, mode?: string, now: string, maxPullRequests?: number }} options
   * @returns {Run}
   */
  startRun({ hardStop, mode = 'OBSERVE_ONLY', now, maxPullRequests = DEFAULT_LIMITS.maxPullRequests }) {
    if (!RUN_MODES.includes(mode)) throw new Error(`unknown run mode ${mode}`)
    // A hard stop that does not parse is worse than none: the brake compares
    // Date.parse(hardStop), and NaN makes every comparison false, so an
    // unusable value would silently disable the stop rather than announce it.
    if (typeof hardStop !== 'string' || Number.isNaN(Date.parse(hardStop))) {
      throw new Error(`hardStop must be a parseable timestamp, received ${JSON.stringify(hardStop)}`)
    }
    const existing = this.loadRun()
    if (existing) return existing
    const run = {
      runId: randomUUID(),
      startedAt: now,
      hardStop,
      mode,
      lastProgressAt: now,
      noProgressCycles: 0,
      emergencyStop: false,
      pullRequestsOpened: 0,
      maxPullRequests,
    }
    writeJson(this.dir, RUN_FILE, run)
    this.appendEvent({ at: now, kind: 'RUN_STARTED', runId: run.runId, mode })
    return run
  }

  /** @param {Run} run */
  saveRun(run) {
    writeJson(this.dir, RUN_FILE, run)
    return run
  }

  /**
   * Only call on real evidence: a transition, a result, a mutation.
   *
   * @param {string} now
   */
  recordProgress(now) {
    const run = this.loadRun()
    if (!run) return null
    run.lastProgressAt = now
    run.noProgressCycles = 0
    return this.saveRun(run)
  }

  /**
   * @param {boolean} stopped
   * @param {string} now
   * @param {string} [reason]
   */
  setEmergencyStop(stopped, now, reason) {
    const run = this.loadRun()
    if (!run) throw new Error('no run to stop')
    run.emergencyStop = Boolean(stopped)
    this.saveRun(run)
    this.appendEvent({
      at: now,
      kind: stopped ? 'EMERGENCY_STOP_ENGAGED' : 'EMERGENCY_STOP_CLEARED',
      reason,
    })
    return run
  }

  // ---- TASKS -------------------------------------------------------------

  /** @returns {Record<string, Task>} */
  loadTasks() {
    return readJson(this.dir, TASKS_FILE, {})
  }

  /** @returns {Task[]} */
  listTasks() {
    return /** @type {Task[]} */ (Object.values(this.loadTasks())).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    )
  }

  /** @param {Task} task */
  upsertTask(task) {
    if (!task.id) throw new Error('task requires an id')
    if (task.status && !TASK_STATES.includes(task.status)) {
      throw new Error(`unknown task state ${task.status}`)
    }
    const tasks = this.loadTasks()
    tasks[task.id] = {
      status: 'QUEUED',
      attempts: 0,
      repeatedFailures: 0,
      dependencies: [],
      mutating: false,
      ...tasks[task.id],
      ...task,
    }
    writeJson(this.dir, TASKS_FILE, tasks)
    return tasks[task.id]
  }

  /**
   * The only way a task changes state. Every transition is evidenced in the
   * event log, so "what happened" is reconstructable without the model.
   *
   * @param {string} taskId
   * @param {TaskState} status
   * @param {{ at?: string|undefined, evidence?: string|undefined, failureClass?: string|undefined,
   *   nextAction?: string|null|undefined, blocker?: string|null|undefined }} [options]
   */
  transition(taskId, status, { at, evidence, failureClass, nextAction, blocker } = {}) {
    if (!TASK_STATES.includes(status)) throw new Error(`unknown task state ${status}`)
    const tasks = this.loadTasks()
    const task = tasks[taskId]
    if (!task) throw new Error(`unknown task ${taskId}`)
    const from = task.status
    task.status = status
    if (nextAction !== undefined) task.nextAction = nextAction
    if (blocker !== undefined) task.blocker = blocker
    if (failureClass !== undefined) task.lastFailureClass = failureClass
    writeJson(this.dir, TASKS_FILE, tasks)
    this.appendEvent({
      at,
      kind: 'TASK_TRANSITION',
      task: taskId,
      from,
      to: status,
      evidence,
      failureClass,
    })
    return task
  }

  /**
   * @param {string} taskId
   * @param {{ at?: string|undefined, failureClass?: string|undefined }} [options]
   */
  recordAttempt(taskId, { at, failureClass } = {}) {
    const tasks = this.loadTasks()
    const task = tasks[taskId]
    if (!task) throw new Error(`unknown task ${taskId}`)
    task.attempts = (task.attempts ?? 0) + 1
    // Repeated *identical* failure is the circuit breaker: a different failure
    // each time is progress of a sort, the same one twice is thrash.
    if (failureClass && failureClass === task.lastFailureClass) {
      task.repeatedFailures = (task.repeatedFailures ?? 0) + 1
    } else if (failureClass) {
      task.repeatedFailures = 0
    }
    if (failureClass) task.lastFailureClass = failureClass
    writeJson(this.dir, TASKS_FILE, tasks)
    this.appendEvent({ at, kind: 'TASK_ATTEMPT', task: taskId, attempts: task.attempts, failureClass })
    return task
  }

  // ---- CHECKPOINTS -------------------------------------------------------

  /** @returns {Record<string, any>} */
  loadCheckpoints() {
    return readJson(this.dir, CHECKPOINTS_FILE, {})
  }

  /**
   * A checkpoint is what lets the next worker resume without this session's
   * context. It records what was actually done, not what was intended.
   *
   * @param {string} taskId
   * @param {Record<string, any>} checkpoint
   */
  saveCheckpoint(taskId, checkpoint) {
    const checkpoints = this.loadCheckpoints()
    checkpoints[taskId] = { taskId, ...checkpoint }
    writeJson(this.dir, CHECKPOINTS_FILE, checkpoints)
    this.appendEvent({ at: checkpoint.at, kind: 'CHECKPOINT', task: taskId, sha: checkpoint.sha })
    return checkpoints[taskId]
  }

  /** @param {string} taskId */
  getCheckpoint(taskId) {
    return this.loadCheckpoints()[taskId] ?? null
  }

  // ---- EVENTS ------------------------------------------------------------

  /** @param {Record<string, any>} event */
  appendEvent(event) {
    assertNoSecrets(event, 'event')
    mkdirSync(this.dir, { recursive: true })
    appendFileSync(join(this.dir, EVENTS_FILE), `${JSON.stringify(event)}\n`)
    return event
  }

  readEvents() {
    const target = join(this.dir, EVENTS_FILE)
    let raw
    try {
      raw = readFileSync(target, 'utf8')
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error)?.code === 'ENOENT') return []
      throw error
    }
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  }

  // ---- LEASE -------------------------------------------------------------

  /**
   * One writer lane. A lease is held by pid+holder with an expiry, so a crashed
   * holder frees the lane by time rather than needing a human to notice.
   *
   * @param {string} holder
   * @param {{ at: string, ttlMs?: number }} options
   */
  acquireLease(holder, { at, ttlMs = 45 * 60 * 1000 }) {
    const current = readJson(this.dir, LEASE_FILE, null)
    const now = Date.parse(at)
    if (current && current.holder !== holder && Date.parse(current.expiresAt) > now) {
      return { acquired: false, heldBy: current.holder, expiresAt: current.expiresAt }
    }
    const lease = {
      holder,
      pid: process.pid,
      acquiredAt: at,
      expiresAt: new Date(now + ttlMs).toISOString(),
    }
    writeJson(this.dir, LEASE_FILE, lease)
    return { acquired: true, lease }
  }

  /**
   * @param {string} holder
   * @param {string} at
   */
  releaseLease(holder, at) {
    const current = readJson(this.dir, LEASE_FILE, null)
    if (!current || current.holder !== holder) return false
    writeJson(this.dir, LEASE_FILE, { holder: null, releasedAt: at })
    return true
  }
}
