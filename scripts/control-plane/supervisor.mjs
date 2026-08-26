/**
 * The loop that keeps running.
 *
 * `cli.mjs run` is a BATCH: it ticks until nothing can be advanced this pass,
 * prints, and exits. That is the right shape for a person at a terminal and the
 * wrong shape for a programme, because almost every stop it reports is
 * temporary — `WAITING_EXTERNAL` means "CI is running", `IDLE` means "nothing
 * is runnable right now", and both become runnable again without anyone typing
 * anything. A batch loop turns every external wait into a wait for a human.
 *
 * So this runs passes until a reason to stop that is actually a reason to stop:
 * the run is complete, the hard stop is reached, or someone pulled the brake.
 *
 * TWO THINGS IT OWNS THAT THE ENGINE DOES NOT.
 *
 * 1. THE WRITER LANE. `state.mjs` has held a lease since Loop Bootstrap and
 *    nothing has ever acquired it — noted plainly when the ledger landed, since
 *    an unheld lease is why concurrent read-modify-write was not hypothetical.
 *    A supervisor takes it before its first tick, renews it while it runs, and
 *    releases it on the way out. A second supervisor against the same state
 *    refuses to start rather than interleaving with the first.
 *
 * 2. RECONCILING WHAT A CRASH LEFT BEHIND. A task is marked `RUNNING` before
 *    its handler is called. If the process dies in between, that mark outlives
 *    it — and `RUNNING` is neither terminal nor waiting, so the scheduler is
 *    perfectly happy to select it again. For a read-only handler that is free.
 *    For a mutating one it is a second push, a second commit, or a SECOND PULL
 *    REQUEST, because the control plane cannot see what the previous process
 *    managed to do before it died.
 *
 *    So an interrupted mutation is parked for the owner and an interrupted
 *    read is re-queued. That is not caution for its own sake: "did something
 *    happen out there" is a question the loop genuinely cannot answer from its
 *    own state, which is exactly what `WAITING_OWNER` is for. It parks one
 *    task, not the programme — everything independent keeps moving.
 */

import { hostname } from 'node:os'

import { LoopEngine } from './loop.mjs'

/** Outcomes that end the supervisor rather than pausing it. */
export const TERMINAL_OUTCOMES = Object.freeze([
  'NO_RUN',
  'ALL_COMPLETE',
  'HARD_STOP',
  'EMERGENCY_STOP',
])

/** How long a pass waits before looking again, by why it stopped. */
export const DEFAULT_SLEEPS = Object.freeze({
  // Something external is expected to change: CI finishing, a review arriving.
  WAITING_EXTERNAL: 60_000,
  // Nothing is runnable and nothing is awaited. Rarer, and worth a longer wait.
  IDLE: 120_000,
  // A person has to act. Looking again quickly does not make that happen sooner.
  WAITING_OWNER: 300_000,
  DEFAULT: 120_000,
})

/**
 * Put right what a dead process left marked `RUNNING`.
 *
 * Called before the first tick, so the scheduler never sees a stale `RUNNING`.
 * Returns what it changed, because a reconciliation nobody can read is
 * indistinguishable from one that did not happen.
 *
 * @param {import('./state.mjs').ControlPlaneState} store
 * @param {{ at: string }} options
 * @returns {Array<{ id: string, to: string, reason: string }>}
 */
export function reconcileInterruptedTasks(store, { at }) {
  const reconciled = []
  for (const task of store.listTasks()) {
    if (task.status !== 'RUNNING') continue

    // A mutating handler may have reached the outside world before the process
    // died, and nothing in this state can say whether it did. Re-dispatching is
    // how one interrupted `pr.create` becomes two pull requests.
    const mutating = Boolean(task.mutating)
    const to = mutating ? 'WAITING_OWNER' : 'QUEUED'
    const reason = mutating
      ? 'interrupted mid-mutation: whether it reached the outside world is not knowable from here'
      : 'interrupted mid-read: gathering the evidence again costs nothing'

    store.transition(task.id, /** @type {any} */ (to), {
      at,
      evidence: `reconciled after restart — ${reason}`,
      blocker: mutating ? 'INTERRUPTED_MUTATION' : null,
      nextAction: mutating
        ? 'confirm whether the mutation landed, then re-queue or complete this task'
        : null,
    })
    reconciled.push({ id: task.id, to, reason })
  }
  return reconciled
}

/**
 * @typedef {{ at: string, outcome: string, sleptMs?: number }} Pass
 */

export class Supervisor {
  /**
   * @param {{ store: import('./state.mjs').ControlPlaneState,
   *   handlers?: Record<string, (ctx: any) => Promise<any>>,
   *   engine?: LoopEngine,
   *   now: () => string,
   *   sleep: (ms: number) => Promise<void>,
   *   holder?: string,
   *   leaseTtlMs?: number,
   *   sleeps?: Record<string, number>,
   *   maxPasses?: number,
   *   log?: (message: string) => void }} options
   */
  constructor({
    store,
    handlers = {},
    engine,
    now,
    sleep,
    holder = `supervisor@${hostname()}`,
    leaseTtlMs = 15 * 60 * 1000,
    sleeps = DEFAULT_SLEEPS,
    maxPasses = 1000,
    log = () => {},
  }) {
    this.store = store
    this.now = now
    this.sleep = sleep
    this.holder = holder
    this.leaseTtlMs = leaseTtlMs
    this.sleeps = sleeps
    this.maxPasses = maxPasses
    this.log = log
    this.engine = engine ?? new LoopEngine({ store, handlers, now })
  }

  /** How long to wait after a pass that stopped for this reason. */
  /** @param {string} outcome */
  #sleepFor(outcome) {
    return this.sleeps[outcome] ?? this.sleeps.DEFAULT ?? DEFAULT_SLEEPS.DEFAULT
  }

  /**
   * Run passes until something says stop.
   *
   * @returns {Promise<{ outcome: string, passes: Pass[],
   *   reconciled: Array<{ id: string, to: string, reason: string }> }>}
   */
  async run() {
    const lease = this.store.acquireLease(this.holder, {
      at: this.now(),
      ttlMs: this.leaseTtlMs,
    })
    if (!lease.acquired) {
      // Not an error. Another supervisor is doing this work, and two of them
      // interleaving is the failure the lease exists to prevent.
      this.log(`writer lane held by ${lease.heldBy} until ${lease.expiresAt}`)
      return { outcome: 'LEASE_HELD', passes: [], reconciled: [] }
    }

    try {
      const reconciled = reconcileInterruptedTasks(this.store, { at: this.now() })
      for (const entry of reconciled) {
        this.log(`reconciled ${entry.id} -> ${entry.to}: ${entry.reason}`)
      }

      const passes = /** @type {Pass[]} */ ([])
      let outcome = 'MAX_PASSES'

      for (let pass = 0; pass < this.maxPasses; pass += 1) {
        const decisions = await this.engine.run({ maxTicks: 50 })
        const last = decisions.at(-1)
        outcome = last?.outcome ?? 'IDLE'

        if (TERMINAL_OUTCOMES.includes(outcome)) {
          passes.push({ at: this.now(), outcome })
          this.log(`stopping: ${outcome}`)
          return { outcome, passes, reconciled }
        }

        // Renew before sleeping rather than after: the lease has to outlive the
        // wait, or a second supervisor takes the lane while this one is idle
        // and both wake up holding it.
        const at = this.now()
        this.store.acquireLease(this.holder, { at, ttlMs: this.leaseTtlMs })

        const sleptMs = this.#sleepFor(outcome)
        passes.push({ at, outcome, sleptMs })
        this.log(`${outcome}; looking again in ${Math.round(sleptMs / 1000)}s`)
        await this.sleep(sleptMs)
      }

      return { outcome, passes, reconciled }
    } finally {
      this.store.releaseLease(this.holder, this.now())
    }
  }
}
