/**
 * Durable control-plane state, in one transactional ledger.
 *
 * WHAT WAS ACTUALLY WRONG WITH THE FILES. `state.mjs` is plain JSON, and says
 * why: disposable, `cat`-able, no native dependency. Those are real virtues and
 * this keeps all three. What it cannot do is land two facts at once.
 *
 *   - Every mutation is read-modify-write over a WHOLE table. Two writers
 *     interleaving lose one of the two updates, and the loser leaves no trace.
 *   - `transition` writes `tasks.json` and then appends to `events.jsonl`. A
 *     crash between the two leaves a ledger that disagrees with itself: a task
 *     that moved with no record of moving, or a record of a move that did not
 *     happen. Same for `saveCheckpoint`.
 *   - The lease exists to serialise writers and nothing acquires it, so the
 *     first point is not hypothetical.
 *
 * Each of those is one transaction away from being impossible, which is what
 * this is.
 *
 * WHY `node:sqlite`. It ships with the Node this repository pins in `.nvmrc`,
 * so the ledger costs no dependency, no native build and no audit surface —
 * the same reason the JSON store avoided one. It is marked EXPERIMENTAL by
 * Node and prints a warning on load; the mitigation is the pin, which means the
 * API cannot move underneath this without a deliberate Node bump and this
 * file's tests running against it. That is a trade worth naming rather than
 * burying: a stable API would be better, and a native dependency would be
 * worse.
 *
 * WHY THE ROWS ARE DOCUMENTS. A task's shape belongs to `policy.mjs`, not to a
 * schema here. Columns are extracted only where the ledger itself must order or
 * filter (`sort_order`, `status`); everything else is the record verbatim. A
 * new task field is then a change in one place rather than a migration.
 *
 * This is a drop-in for `ControlPlaneStore`: same methods, same return shapes.
 * `tests/scripts/controlPlaneLedger.test.ts` runs one conformance suite against
 * both, so "drop-in" is measured rather than asserted.
 */

import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { DEFAULT_LIMITS, TASK_STATES, RUN_MODES } from './policy.mjs'
import { ControlPlaneStore, assertNoSecrets, stateDir } from './state.mjs'

/**
 * @typedef {import('./policy.mjs').Task} Task
 * @typedef {import('./policy.mjs').Run} Run
 */

/**
 * `node:sqlite`, loaded on first use rather than at import.
 *
 * A static `import ... from 'node:sqlite'` would be the honest shape and is
 * what this wants to be. It cannot be yet: the Vite version behind Vitest does
 * not have `node:sqlite` in the built-in list it externalises for the default
 * jsdom environment, so it tries to BUNDLE a Node built-in and every test that
 * transitively reaches this file fails to load — including tests that never
 * open a ledger. Externalising it through `server.deps.external` and through
 * the environments API were both tried and neither takes.
 *
 * Nothing is hidden by this: the specifier is literal and greppable, and the
 * module is still a Node built-in with no dependency behind it. The deferral
 * also confines Node's EXPERIMENTAL warning to processes that actually open a
 * ledger, rather than printing it for anything that imports the control plane.
 *
 * Revisit when Vite knows the built-in; a static import is strictly better.
 */
function databaseSync() {
  return createRequire(import.meta.url)('node:sqlite').DatabaseSync
}

/** Where the ledger lives when the caller does not say. */
export function ledgerPath() {
  return process.env.PREDICTOR_CONTROL_LEDGER ?? join(stateDir(), 'control-plane.sqlite')
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS run (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    document TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    document TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS checkpoints (
    task_id TEXT PRIMARY KEY,
    document TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT,
    kind TEXT,
    document TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS lease (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    document TEXT
  );
`

/** @param {unknown} value */
const document = (value) => JSON.stringify(assertNoSecrets(value))

/** @param {unknown} row */
const parse = (row) => (typeof row === 'string' ? JSON.parse(row) : null)

export class ControlPlaneLedger {
  /** @param {string} [file] */
  constructor(file = ledgerPath()) {
    this.file = file
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
    const DatabaseSync = databaseSync()
    this.db = new DatabaseSync(file)
    // WAL so a reader never blocks the writer, and a busy timeout so two
    // processes queue rather than one of them failing outright — the ledger's
    // whole purpose is to make concurrent writers safe rather than unlikely.
    if (file !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA busy_timeout = 5000;')
    this.db.exec(SCHEMA)
  }

  /** Release the handle. Safe to call twice. */
  close() {
    try {
      this.db.close()
    } catch {
      // Already closed. Closing is not the sort of thing worth failing over.
    }
  }

  /**
   * Run `work` inside one transaction.
   *
   * IMMEDIATE rather than DEFERRED: the write lock is taken up front, so two
   * writers serialise at BEGIN instead of discovering the conflict at COMMIT
   * with work already done on a stale read. That is the read-modify-write race
   * the files could not close.
   *
   * @template T
   * @param {() => T} work
   * @returns {T}
   */
  #transaction(work) {
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const result = work()
      this.db.exec('COMMIT;')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK;')
      throw error
    }
  }

  /**
   * Append an event as part of the caller's transaction, never on its own.
   *
   * A state change and the record of it land together or not at all. Split
   * across two writes, a crash between them leaves the ledger disagreeing with
   * itself, which is the failure this class exists to remove.
   *
   * @param {Record<string, any>} event
   */
  #recordEvent(event) {
    assertNoSecrets(event, 'event')
    this.db
      .prepare('INSERT INTO events (at, kind, document) VALUES (?, ?, ?)')
      .run(event.at ?? null, event.kind ?? null, JSON.stringify(event))
    return event
  }

  // ---- RUN ---------------------------------------------------------------

  /** @returns {Run | null} */
  loadRun() {
    const row = this.db.prepare('SELECT document FROM run WHERE id = 1').get()
    return parse(row?.document)
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
    return this.#transaction(() => {
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
      this.db.prepare('INSERT INTO run (id, document) VALUES (1, ?)').run(document(run))
      this.#recordEvent({ at: now, kind: 'RUN_STARTED', runId: run.runId, mode })
      return run
    })
  }

  /** @param {Run} run */
  saveRun(run) {
    return this.#transaction(() => {
      this.db
        .prepare('INSERT INTO run (id, document) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document')
        .run(document(run))
      return run
    })
  }

  /**
   * Only call on real evidence: a transition, a result, a mutation.
   *
   * @param {string} now
   */
  recordProgress(now) {
    return this.#transaction(() => {
      const run = this.loadRun()
      if (!run) return null
      run.lastProgressAt = now
      run.noProgressCycles = 0
      this.db.prepare('UPDATE run SET document = ? WHERE id = 1').run(document(run))
      return run
    })
  }

  /**
   * @param {boolean} stopped
   * @param {string} now
   * @param {string} [reason]
   */
  setEmergencyStop(stopped, now, reason) {
    return this.#transaction(() => {
      const run = this.loadRun()
      if (!run) throw new Error('no run to stop')
      run.emergencyStop = Boolean(stopped)
      this.db.prepare('UPDATE run SET document = ? WHERE id = 1').run(document(run))
      this.#recordEvent({
        at: now,
        kind: stopped ? 'EMERGENCY_STOP_ENGAGED' : 'EMERGENCY_STOP_CLEARED',
        reason,
      })
      return run
    })
  }

  // ---- TASKS -------------------------------------------------------------

  /** @returns {Record<string, Task>} */
  loadTasks() {
    const rows = this.db.prepare('SELECT id, document FROM tasks').all()
    return Object.fromEntries(rows.map((/** @type {any} */ row) => [row.id, parse(row.document)]))
  }

  /** @returns {Task[]} */
  listTasks() {
    const rows = this.db
      .prepare('SELECT document FROM tasks ORDER BY sort_order ASC, id ASC')
      .all()
    return rows.map((/** @type {any} */ row) => parse(row.document))
  }

  /** @param {Task} task */
  upsertTask(task) {
    if (!task.id) throw new Error('task requires an id')
    if (task.status && !TASK_STATES.includes(task.status)) {
      throw new Error(`unknown task state ${task.status}`)
    }
    return this.#transaction(() => {
      const existing = parse(
        this.db.prepare('SELECT document FROM tasks WHERE id = ?').get(task.id)?.document,
      )
      // The same defaults, in the same order, as the file store. Conformance is
      // measured against it, and a default that differs is a divergence like
      // any other.
      const merged = {
        status: 'QUEUED',
        attempts: 0,
        repeatedFailures: 0,
        dependencies: [],
        mutating: false,
        ...existing,
        ...task,
      }
      this.#writeTask(merged)
      return merged
    })
  }

  /** @param {Task} task */
  #writeTask(task) {
    this.db
      .prepare(
        'INSERT INTO tasks (id, sort_order, status, document) VALUES (?, ?, ?, ?) ' +
          'ON CONFLICT(id) DO UPDATE SET sort_order = excluded.sort_order, ' +
          'status = excluded.status, document = excluded.document',
      )
      .run(task.id, task.order ?? 0, task.status ?? 'QUEUED', document(task))
  }

  /**
   * @param {string} taskId
   * @param {import('./policy.mjs').TaskState} status
   * @param {{ at?: string, evidence?: string, failureClass?: string,
   *   nextAction?: string | null, blocker?: string | null }} [details]
   */
  transition(taskId, status, { at, evidence, failureClass, nextAction, blocker } = {}) {
    if (!TASK_STATES.includes(status)) throw new Error(`unknown task state ${status}`)
    return this.#transaction(() => {
      const task = parse(this.db.prepare('SELECT document FROM tasks WHERE id = ?').get(taskId)?.document)
      if (!task) throw new Error(`unknown task ${taskId}`)
      const from = task.status
      task.status = status
      // `evidence` is deliberately NOT copied onto the task. The file store
      // keeps it in the event log alone, so the task row is current state and
      // the log is history; duplicating it here would put the same fact in two
      // places that can disagree.
      if (nextAction !== undefined) task.nextAction = nextAction
      if (blocker !== undefined) task.blocker = blocker
      if (failureClass !== undefined) task.lastFailureClass = failureClass
      this.#writeTask(task)
      this.#recordEvent({ at, kind: 'TASK_TRANSITION', task: taskId, from, to: status, evidence, failureClass })
      return task
    })
  }

  /**
   * @param {string} taskId
   * @param {{ at?: string, failureClass?: string }} [details]
   */
  recordAttempt(taskId, { at, failureClass } = {}) {
    return this.#transaction(() => {
      const task = parse(this.db.prepare('SELECT document FROM tasks WHERE id = ?').get(taskId)?.document)
      if (!task) throw new Error(`unknown task ${taskId}`)
      task.attempts = (task.attempts ?? 0) + 1
      // Repeated *identical* failure is the circuit breaker: a different failure
      // each time is progress of a sort, the same one twice is thrash. An
      // attempt with no class at all leaves the counter alone rather than
      // clearing it, which is what the file store does.
      if (failureClass && failureClass === task.lastFailureClass) {
        task.repeatedFailures = (task.repeatedFailures ?? 0) + 1
      } else if (failureClass) {
        task.repeatedFailures = 0
      }
      if (failureClass) task.lastFailureClass = failureClass
      this.#writeTask(task)
      this.#recordEvent({ at, kind: 'TASK_ATTEMPT', task: taskId, attempts: task.attempts, failureClass })
      return task
    })
  }

  // ---- CHECKPOINTS -------------------------------------------------------

  /** @returns {Record<string, any>} */
  loadCheckpoints() {
    const rows = this.db.prepare('SELECT task_id, document FROM checkpoints').all()
    return Object.fromEntries(rows.map((/** @type {any} */ row) => [row.task_id, parse(row.document)]))
  }

  /**
   * A checkpoint is what lets the next worker resume without this session's
   * context. It records what was actually done, not what was intended.
   *
   * @param {string} taskId
   * @param {Record<string, any>} checkpoint
   */
  saveCheckpoint(taskId, checkpoint) {
    return this.#transaction(() => {
      const record = { taskId, ...checkpoint }
      this.db
        .prepare(
          'INSERT INTO checkpoints (task_id, document) VALUES (?, ?) ' +
            'ON CONFLICT(task_id) DO UPDATE SET document = excluded.document',
        )
        .run(taskId, document(record))
      this.#recordEvent({ at: checkpoint.at, kind: 'CHECKPOINT', task: taskId, sha: checkpoint.sha })
      return record
    })
  }

  /** @param {string} taskId */
  getCheckpoint(taskId) {
    return parse(
      this.db.prepare('SELECT document FROM checkpoints WHERE task_id = ?').get(taskId)?.document,
    )
  }

  // ---- EVENTS ------------------------------------------------------------

  /** @param {Record<string, any>} event */
  appendEvent(event) {
    return this.#transaction(() => this.#recordEvent(event))
  }

  readEvents() {
    return this.db
      .prepare('SELECT document FROM events ORDER BY seq ASC')
      .all()
      .map((/** @type {any} */ row) => parse(row.document))
  }

  // ---- IMPORT ------------------------------------------------------------

  /**
   * Write a whole file-backed run into the ledger in one transaction.
   *
   * Not part of the `ControlPlaneStore` surface: it exists only for the
   * migration, and it writes records verbatim rather than re-deriving them, so
   * an imported history reads exactly as it was recorded.
   *
   * @param {{ run: any, tasks: any[], checkpoints: Array<[string, any]>, events: any[] }} state
   */
  importRun({ run, tasks, checkpoints, events }) {
    return this.#transaction(() => {
      this.db.prepare('INSERT INTO run (id, document) VALUES (1, ?)').run(document(run))
      for (const task of tasks) this.#writeTask(task)
      for (const [taskId, checkpoint] of checkpoints) {
        this.db
          .prepare('INSERT INTO checkpoints (task_id, document) VALUES (?, ?)')
          .run(taskId, document(checkpoint))
      }
      // Straight through `#recordEvent` so the imported log keeps its order and
      // its contents, rather than being summarised into one "imported" entry.
      for (const event of events) this.#recordEvent(event)
      return { tasks: tasks.length, events: events.length }
    })
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
    return this.#transaction(() => {
      const current = parse(this.db.prepare('SELECT document FROM lease WHERE id = 1').get()?.document)
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
      this.db
        .prepare('INSERT INTO lease (id, document) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document')
        .run(document(lease))
      return { acquired: true, lease }
    })
  }

  /**
   * @param {string} holder
   * @param {string} at
   */
  releaseLease(holder, at) {
    return this.#transaction(() => {
      const current = parse(this.db.prepare('SELECT document FROM lease WHERE id = 1').get()?.document)
      if (!current || current.holder !== holder) return false
      this.db.prepare('UPDATE lease SET document = ? WHERE id = 1').run(document({ holder: null, releasedAt: at }))
      return true
    })
  }
}

/**
 * Move an existing file-backed run into the ledger, once.
 *
 * "Durable from now on, and your current run is gone" is not durable. A state
 * directory that already holds a run is copied across in ONE transaction, so a
 * crash during the import leaves the ledger empty and the files untouched —
 * still the source of truth, still importable on the next attempt.
 *
 * A ledger that already holds a run is left alone. The import is a migration,
 * not a merge, and merging two disagreeing histories is exactly the thing this
 * class exists to make impossible.
 *
 * @param {ControlPlaneLedger} ledger
 * @param {string} dir
 * @returns {{ imported: boolean, reason: string, tasks?: number, events?: number }}
 */
export function importFromFiles(ledger, dir) {
  if (ledger.loadRun()) return { imported: false, reason: 'ledger already holds a run' }

  const files = new ControlPlaneStore(dir)
  const run = files.loadRun()
  if (!run) return { imported: false, reason: 'no file-backed run to import' }

  const tasks = Object.values(files.loadTasks())
  const checkpoints = Object.entries(files.loadCheckpoints())
  const events = files.readEvents()

  // The lease is deliberately NOT carried across. It is transient by design —
  // held with a TTL so a crashed holder frees the lane by time — and the
  // process doing the import is a new writer that should take its own.
  ledger.importRun({ run, tasks, checkpoints, events })
  return { imported: true, reason: `imported run ${run.runId}`, tasks: tasks.length, events: events.length }
}

/**
 * The store the control plane should use.
 *
 * The ledger is the default, because the transactional guarantees are the point
 * of having one. `PREDICTOR_CONTROL_STATE_BACKEND=files` is the way back to the
 * JSON store — kept because a backend nobody can leave is a backend nobody can
 * debug, and because the conformance suite proves the two are interchangeable.
 *
 * @param {{ dir?: string, backend?: string }} [options]
 */
export function openControlPlaneState({ dir = stateDir(), backend } = {}) {
  const chosen = backend ?? process.env.PREDICTOR_CONTROL_STATE_BACKEND ?? 'ledger'
  if (chosen === 'files') return new ControlPlaneStore(dir)
  if (chosen !== 'ledger') throw new Error(`unknown control-plane state backend ${JSON.stringify(chosen)}`)

  const ledger = new ControlPlaneLedger(join(dir, 'control-plane.sqlite'))
  importFromFiles(ledger, dir)
  return ledger
}
