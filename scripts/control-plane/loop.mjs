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
 * @param {import('./state.mjs').ControlPlaneState} options.store
 * @param {Record<string, (ctx) => Promise<object>>} options.handlers
 *   Task handlers keyed by `task.handler`. A handler returns
 *   `{ ok, evidence, failureClass?, checkpoint?, status?, nextAction? }`.
 * @param {() => string} options.now ISO clock, injected so tests are deterministic.
 */
export class LoopEngine {
  /**
   * @param {{ store: import('./state.mjs').ControlPlaneState,
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

    if (!task) return this.#nothingRunnable(run, tasks, at)

    return this.#dispatch(task, run, at)
  }

  /**
   * Dispatch one task: gate it, run it, settle it.
   *
   * Extracted verbatim from `tick` so that one task and several share exactly
   * the same path. A parallel dispatcher that reimplemented the gates would be
   * a second place where mutation is authorised, and the whole design has one.
   *
   * @param {Task} task
   * @param {any} run
   * @param {string} at
   */
  async #dispatch(task, run, at) {
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

  /**
   * The tasks to dispatch together, and never more than one that mutates.
   *
   * WHY AT MOST ONE MUTATION. Two mutating tasks in flight is two pushes on one
   * branch, or a commit racing the push that was meant to carry it. That is not
   * a race worth having for the throughput it buys, and no bound short of one
   * makes it safe. Read-only work has no such problem: observing a pull request
   * while another task pushes is exactly the overlap worth taking.
   *
   * Dependency safety comes for free rather than from a second check here:
   * `selectEligibleTask` only returns tasks whose dependencies have COMPLETED,
   * so nothing in a batch can depend on anything else in it.
   *
   * @param {any} run
   * @param {Task[]} tasks
   * @param {string} at
   * @returns {Task[]}
   */
  #selectBatch(run, tasks, at) {
    const limit = Math.max(1, this.limits.maxConcurrentTasks ?? 1)
    const chosen = /** @type {Task[]} */ ([])
    let pool = tasks
    let mutatingChosen = false

    while (chosen.length < limit) {
      const task = selectEligibleTask({ ...run, now: at }, pool, this.limits)
      if (!task) break
      pool = pool.filter((candidate) => candidate.id !== task.id)
      if (task.mutating) {
        // Skip it and keep looking: a second mutation waits for the next pass,
        // but independent read-only work behind it should not.
        if (mutatingChosen) continue
        mutatingChosen = true
      }
      chosen.push(task)
    }
    return chosen
  }

  /**
   * Advance the programme by up to `maxConcurrentTasks` steps at once.
   *
   * With the default limit of one this is `tick` exactly — parallelism is
   * something a caller opts into, not something that arrives with an upgrade.
   *
   * @returns {Promise<any[]>} one decision per dispatched task, or one for why
   *   nothing was.
   */
  async tickBatch() {
    const at = this.now()
    const run = this.store.loadRun()
    if (!run) return [{ at, outcome: 'NO_RUN' }]
    if (run.emergencyStop) return [{ at, outcome: 'EMERGENCY_STOP', dispatched: null }]
    if (run.hardStop && Date.parse(at) >= Date.parse(run.hardStop)) {
      return [{ at, outcome: 'HARD_STOP', dispatched: null }]
    }

    const tasks = this.store.listTasks()
    const batch = this.#selectBatch(run, tasks, at)
    if (batch.length === 0) return [this.#nothingRunnable(run, tasks, at)]

    // Marked RUNNING before any handler is awaited, so a crash mid-batch leaves
    // every one of them reconcilable — the supervisor's reconciler reads that
    // mark and cannot see a task it was never told about.
    //
    // WHY allSettled RATHER THAN all. `#dispatch` guards the handler call but
    // not the state writes around it, so it can still reject: the `transition`
    // to RUNNING, and every write in `#settle`, are unguarded. A full,
    // unwritable or failing state directory throws there — ENOSPC, EIO, EACCES.
    // No handler currently in the tree can reject any other way, and none can
    // return a status outside `TASK_STATES`; the disk is the live vector, and
    // it is enough. `Promise.all` hands that first rejection straight to the
    // caller while the siblings are still running.
    //
    // That matters because of who the caller is. The supervisor releases the
    // writer lease in a `finally`, so a rejection here frees the lane — writing
    // `holder: null`, immediately — while this batch still has handlers in
    // flight against tasks it left marked RUNNING. The next supervisor takes
    // the lane, reads those marks as a dead process's leftovers and reconciles
    // them, and now the abandoned handler and the reconciler are both writing,
    // which is the one thing the lease exists to prevent. Worse for a mutating
    // task: the reconciler parks it WAITING_OWNER precisely because nobody can
    // tell whether it reached the outside world, and the still-live handler
    // then overwrites that with COMPLETED.
    //
    // So: drain every dispatch, then rethrow. The failure still propagates —
    // it is not swallowed, and a batch that partly failed is not reported as a
    // success — but the lane is not handed to the next supervisor mid-flight.
    //
    // This bounds the exposure rather than closing it. The lease is not renewed
    // inside a pass (`supervisor.mjs` renews only between passes), so a batch
    // that drains for longer than `leaseTtlMs` still lets a second supervisor
    // in by expiry. That hole predates this change and is not specific to
    // failure: any pass longer than the TTL has it. What changes here is that
    // the lane goes from available immediately to available no sooner than the
    // TTL. An intra-pass heartbeat is the fix for the rest.
    const settled = await Promise.allSettled(batch.map((task) => this.#dispatch(task, run, at)))
    const failures = settled
      .filter((outcome) => outcome.status === 'rejected')
      .map((outcome) => /** @type {PromiseRejectedResult} */ (outcome).reason)

    if (failures.length > 0) {
      // One failure propagates as itself, so the common case reads exactly as
      // it did before. Several are aggregated rather than picked between,
      // because a disk that failed two writes should not report one of them.
      if (failures.length === 1) throw failures[0]
      throw new AggregateError(failures, `${failures.length} dispatches failed in one batch`)
    }

    return settled.map((outcome) => /** @type {PromiseFulfilledResult<any>} */ (outcome).value)
  }

  /** Record the outcome of one dispatch: checkpoint, count, transition. */
  /**
   * @param {Task} task
   * @param {HandlerResult} result
   * @param {string} at
   */
  #settle(task, result, at) {
    // A superseded run is not an attempt. The work was abandoned because a newer
    // commit replaced the one being measured, so counting it would spend the
    // task's three attempts on pushes rather than on problems.
    if (result.failureClass !== 'SUPERSEDED') {
      this.store.recordAttempt(task.id, { at, failureClass: result.failureClass })
    }

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
    // SUPERSEDED is neither: nothing was learned and nothing was attempted, so
    // it must not reset the stall clock either.
    if (
      result.failureClass &&
      result.failureClass !== 'UNKNOWN' &&
      result.failureClass !== 'SUPERSEDED'
    ) {
      this.store.recordProgress(at)
    }
    return {
      at,
      outcome: exhausted ? 'BLOCKED' : 'FAILED',
      dispatched: task.id,
      failureClass: result.failureClass,
      evidence: result.evidence,
    }
  }

  /**
   * Why nothing was dispatched, and what that costs the stall clock.
   *
   * @param {any} run
   * @param {Task[]} tasks
   * @param {string} at
   */
  #nothingRunnable(run, tasks, at) {
    // Distinguish "everything done" from "everything parked" so IDLE never gets
    // mistaken for completion.
    const outcome = this.#idleOutcome(tasks)
    const liveness = assessLiveness(run, at, this.limits)
    // Only genuine idleness counts toward the stall. A programme parked on an
    // external system with nothing else runnable is doing the right thing, and
    // counting that as no-progress escalated a healthy thirty-minute CI wait to
    // BLOCKED in forty minutes.
    if (outcome === 'IDLE' && liveness.verdict !== 'LIVE') {
      run.noProgressCycles = liveness.nextNoProgressCycles
      this.store.saveRun(run)
      this.store.appendEvent({ at, kind: 'NO_PROGRESS', verdict: liveness.verdict })
      return { at, outcome: liveness.verdict, dispatched: null }
    }
    return { at, outcome, dispatched: null }
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
      // `tickBatch` with the default limit of one IS `tick`, so this path is
      // the same path whether or not parallelism is enabled. Two loops would
      // mean two behaviours to keep in step, and they would not stay in step.
      const batch = await this.tickBatch()
      decisions.push(...batch)
      // Outcomes that mean nothing further can be advanced this pass.
      //
      // A per-task BLOCKED is deliberately NOT among them. It used to be, and
      // the first live delivery canary is what showed the cost: one task
      // exhausted its attempts against an unrecoverable environment
      // restriction, `run` stopped there, and the independent work sitting
      // behind it in the queue never ran — the exact failure mode the external
      // wait exists to prevent, arriving through the other door. BLOCKED is
      // terminal for that task, so it is never reselected; the loop simply
      // moves on, and stops when the queue itself is genuinely done or parked.
      const halt = [
        'NO_RUN',
        'EMERGENCY_STOP',
        'HARD_STOP',
        'ALL_COMPLETE',
        'IDLE',
        'WAITING_OWNER',
        'WAITING_EXTERNAL',
        'MUTATION_BLOCKED',
        'STALLED',
      ]
      // Any halting outcome in the batch stops the pass, not just the last one.
      // Today that is the same thing: every halting outcome arrives as a
      // single-element batch, because a dispatch only ever produces COMPLETED,
      // FAILED, BLOCKED or NO_HANDLER, and none of those halt. It is written
      // this way because the alternative is a correctness bug waiting for the
      // first halting dispatch outcome anyone adds — not because it fixes one
      // that exists, and no test claims otherwise.
      if (batch.some((decision) => halt.includes(decision.outcome))) break
    }
    return decisions
  }
}
