/**
 * Loop Bootstrap v0 — the deterministic supervisor.
 *
 * The engine owns the queue, the waiting, the attempt limits and the brakes.
 * A worker (model or script) is dispatched for one bounded task and returns
 * evidence; it does not decide what runs next, when to stop waiting, or whether
 * anything is complete. Those answers come from ./policy.mjs.
 *
 * One `tick()` advances the programme by at most one task. A caller loops ticks;
 * the engine never blocks on external state.
 */

/**
 * @typedef {import('./policy.mjs').Task} Task
 * @typedef {import('./policy.mjs').Limits} Limits
 * @typedef {{ ok: boolean, evidence?: string, failureClass?: string, blocker?: string,
 *   status?: import('./policy.mjs').TaskState, nextAction?: string,
 *   checkpoint?: Record<string, any> }} HandlerResult
 */

import {
  DEFAULT_LIMITS,
  EXTERNAL_WAITING_STATES,
  selectEligibleTask,
  mutationDispatchAllowed,
  assessLiveness,
  ineligibilityReason,
} from './policy.mjs'

/**
 * @param {object} options
 * @param {import('./state.mjs').ControlPlaneStore} options.store
 * @param {Record<string, (ctx) => Promise<object>>} options.handlers
 *   Task handlers keyed by `task.handler`. A handler returns
 *   `{ ok, evidence, failureClass?, checkpoint?, status?, nextAction? }`.
 * @param {() => string} options.now ISO clock, injected so tests are deterministic.
 */
export class LoopEngine {
  /**
   * @param {{ store: import('./state.mjs').ControlPlaneStore,
   *   handlers?: Record<string, (ctx: any) => Promise<HandlerResult>>,
   *   now: () => string, limits?: Limits }} options
   */
  constructor({ store, handlers = {}, now, limits = DEFAULT_LIMITS }) {
    this.store = store
    this.handlers = handlers
    this.now = now
    this.limits = limits
  }

  /**
   * Advance the programme by one step.
   * Returns a decision record describing what happened and why — every outcome
   * is a named reason, never a silent no-op.
   */
  async tick() {
    const at = this.now()
    const run = this.store.loadRun()
    if (!run) return { at, outcome: 'NO_RUN' }

    if (run.emergencyStop) {
      return { at, outcome: 'EMERGENCY_STOP', dispatched: null }
    }

    if (run.hardStop && Date.parse(at) >= Date.parse(run.hardStop)) {
      return { at, outcome: 'HARD_STOP', dispatched: null }
    }

    const tasks = this.store.listTasks()
    const task = selectEligibleTask({ ...run, now: at }, tasks, this.limits)

    if (!task) {
      // Nothing runnable. Distinguish "everything done" from "everything parked"
      // so IDLE never gets mistaken for completion.
      const outcome = this.#idleOutcome(tasks)
      const liveness = assessLiveness(run, at, this.limits)
      // Only genuine idleness counts toward the stall. A programme parked on an
      // external system with nothing else runnable is doing the right thing, and
      // counting that as no-progress escalated a healthy thirty-minute CI wait
      // to BLOCKED in forty minutes.
      if (outcome === 'IDLE' && liveness.verdict !== 'LIVE') {
        run.noProgressCycles = liveness.nextNoProgressCycles
        this.store.saveRun(run)
        this.store.appendEvent({ at, kind: 'NO_PROGRESS', verdict: liveness.verdict })
        return { at, outcome: liveness.verdict, dispatched: null }
      }
      return { at, outcome, dispatched: null }
    }

    const gate = mutationDispatchAllowed({ ...run, now: at }, this.limits)
    if (task.mutating && !gate.allowed) {
      this.store.transition(task.id, 'WAITING_OWNER', {
        at,
        evidence: `mutation dispatch closed: ${gate.reason}`,
        blocker: gate.reason,
      })
      return { at, outcome: 'MUTATION_BLOCKED', reason: gate.reason, dispatched: task.id }
    }

    const handler = task.handler ? this.handlers[task.handler] : undefined
    if (!handler) {
      this.store.transition(task.id, 'BLOCKED', {
        at,
        evidence: `no handler registered for ${task.handler}`,
        blocker: 'NO_HANDLER',
      })
      return { at, outcome: 'NO_HANDLER', dispatched: task.id }
    }

    this.store.transition(task.id, 'RUNNING', { at, evidence: `dispatch ${task.handler}` })

    let result
    try {
      result = await handler({ task, store: this.store, at, run })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result = { ok: false, failureClass: 'UNKNOWN', evidence: message }
    }

    return this.#settle(task, result, this.now())
  }

  /** Record the outcome of one dispatch: checkpoint, count, transition. */
  /**
   * @param {Task} task
   * @param {HandlerResult} result
   * @param {string} at
   */
  #settle(task, result, at) {
    this.store.recordAttempt(task.id, { at, failureClass: result.failureClass })

    if (result.checkpoint) {
      this.store.saveCheckpoint(task.id, { at, ...result.checkpoint })
    }

    if (result.ok) {
      const status = result.status ?? 'COMPLETED'
      this.store.transition(task.id, status, {
        at,
        evidence: result.evidence,
        nextAction: result.nextAction ?? null,
      })
      this.store.recordProgress(at)
      return { at, outcome: 'COMPLETED', dispatched: task.id, status, evidence: result.evidence }
    }

    // Failure. Re-read the task so the freshly incremented counters decide.
    const tasksById = this.store.loadTasks()
    const refreshed = tasksById[task.id] ?? task
    const reason = ineligibilityReason(refreshed, tasksById, this.limits)
    const exhausted = reason === 'attempts_exhausted' || reason === 'repeated_identical_failure'

    const status = result.status ?? (exhausted ? 'BLOCKED' : 'QUEUED')
    this.store.transition(task.id, status, {
      at,
      evidence: result.evidence,
      failureClass: result.failureClass,
      blocker: exhausted ? reason : (result.blocker ?? null),
      nextAction: result.nextAction ?? null,
    })
    // A classified failure is real diagnostic progress even though it failed;
    // an unclassified one is not, so the stall detector still fires on thrash.
    if (result.failureClass && result.failureClass !== 'UNKNOWN') this.store.recordProgress(at)
    return {
      at,
      outcome: exhausted ? 'BLOCKED' : 'FAILED',
      dispatched: task.id,
      failureClass: result.failureClass,
      evidence: result.evidence,
    }
  }

  /** @param {Task[]} tasks */
  #idleOutcome(tasks) {
    const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]))
    const open = tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status ?? 'QUEUED'))
    if (open.length === 0) return 'ALL_COMPLETE'

    const blockedOnMutation = open.some(
      (t) => t.mutating && ineligibilityReason(t, tasksById, this.limits) === null,
    )
    if (blockedOnMutation) return 'MUTATION_BLOCKED'

    const waitingOwner = open.some((t) => t.status === 'WAITING_OWNER')
    if (waitingOwner && open.every((t) => t.status !== 'QUEUED' && t.status !== 'ELIGIBLE')) {
      return 'WAITING_OWNER'
    }
    // Nothing runnable, but something is genuinely awaited: report the wait, so
    // it reads as a live programme rather than an empty one.
    if (open.some((t) => EXTERNAL_WAITING_STATES.includes(t.status ?? 'QUEUED'))) {
      return 'WAITING_EXTERNAL'
    }
    return 'IDLE'
  }

  /** Run ticks until nothing further can be advanced. Bounded, never infinite. */
  async run({ maxTicks = 50 } = {}) {
    const decisions = []
    for (let i = 0; i < maxTicks; i += 1) {
      const decision = await this.tick()
      decisions.push(decision)
      const halt = [
        'NO_RUN',
        'EMERGENCY_STOP',
        'HARD_STOP',
        'ALL_COMPLETE',
        'IDLE',
        'WAITING_OWNER',
        'WAITING_EXTERNAL',
        'MUTATION_BLOCKED',
        'BLOCKED',
        'STALLED',
      ]
      if (halt.includes(decision.outcome)) break
    }
    return decisions
  }
}
