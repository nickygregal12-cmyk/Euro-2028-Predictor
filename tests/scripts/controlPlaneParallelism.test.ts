import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { DEFAULT_LIMITS } from '../../scripts/control-plane/policy.mjs'
import { LoopEngine } from '../../scripts/control-plane/loop.mjs'
import { ControlPlaneStore } from '../../scripts/control-plane/state.mjs'
import { Supervisor } from '../../scripts/control-plane/supervisor.mjs'

const T0 = '2026-08-26T05:00:00.000Z'
const HARD_STOP = '2026-08-27T00:00:00.000Z'

function programme(tasks: Array<Record<string, unknown>>) {
  const store = new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-parallel-')))
  store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
  for (const task of tasks) store.upsertTask(task as never)
  return store
}

/**
 * A handler that records when it started and finished, and does not resolve
 * until released. Overlap is only observable if two are in flight at once.
 */
function gated() {
  const started: string[] = []
  const release: Array<() => void> = []
  const handler = async ({ task }: any) => {
    started.push(task.id)
    await new Promise<void>((resolve) => release.push(resolve))
    return { ok: true, evidence: `${task.id} done` }
  }
  return { started, releaseAll: () => { for (const r of release.splice(0)) r() }, handler }
}

describe('one at a time unless a caller says otherwise', () => {
  it('defaults to one, so parallelism is never inherited from an upgrade', () => {
    expect(DEFAULT_LIMITS.maxConcurrentTasks).toBe(1)
  })

  it('dispatches exactly one at the default limit, however many are eligible', async () => {
    const store = programme([
      { id: 'a', order: 1, handler: 'h' },
      { id: 'b', order: 2, handler: 'h' },
      { id: 'c', order: 3, handler: 'h' },
    ])
    const { started, releaseAll, handler } = gated()
    const engine = new LoopEngine({ store, now: () => T0, handlers: { h: handler } })

    const batch = engine.tickBatch()
    await Promise.resolve()
    expect(started).toEqual(['a'])
    releaseAll()
    expect(await batch).toHaveLength(1)
  })

  it('runs independent read-only work together when the limit allows it', async () => {
    const store = programme([
      { id: 'a', order: 1, handler: 'h' },
      { id: 'b', order: 2, handler: 'h' },
      { id: 'c', order: 3, handler: 'h' },
    ])
    const { started, releaseAll, handler } = gated()
    const engine = new LoopEngine({
      store, now: () => T0, handlers: { h: handler },
      limits: { ...DEFAULT_LIMITS, maxConcurrentTasks: 3 },
    })

    const batch = engine.tickBatch()
    await Promise.resolve()

    // All three in flight before any of them finished: that is the overlap.
    expect(started).toEqual(['a', 'b', 'c'])
    releaseAll()
    expect((await batch).map((decision: any) => decision.dispatched)).toEqual(['a', 'b', 'c'])
  })
})

describe('never two mutations at once', () => {
  it('takes one mutating task and fills the rest of the batch with reads', async () => {
    const store = programme([
      { id: 'push', order: 1, handler: 'h', mutating: true },
      { id: 'alsoPush', order: 2, handler: 'h', mutating: true },
      { id: 'observe', order: 3, handler: 'h' },
    ])
    const { started, releaseAll, handler } = gated()
    const engine = new LoopEngine({
      store, now: () => T0, handlers: { h: handler },
      limits: { ...DEFAULT_LIMITS, maxConcurrentTasks: 3 },
    })

    const batch = engine.tickBatch()
    await Promise.resolve()

    // Two mutating tasks in flight is two pushes on one branch, or a commit
    // racing the push meant to carry it. The second one waits; the independent
    // read behind it does not.
    expect(started).toEqual(['push', 'observe'])
    releaseAll()
    await batch
    expect(store.loadTasks().alsoPush?.status).toBe('QUEUED')
  })

  it('still dispatches the second mutation on the next pass', async () => {
    const store = programme([
      { id: 'push', order: 1, handler: 'h', mutating: true },
      { id: 'alsoPush', order: 2, handler: 'h', mutating: true },
    ])
    const engine = new LoopEngine({
      store, now: () => T0, handlers: { h: async () => ({ ok: true }) },
      limits: { ...DEFAULT_LIMITS, maxConcurrentTasks: 3 },
    })

    await engine.run({ maxTicks: 5 })

    // Deferred, not dropped.
    expect(store.loadTasks().push?.status).toBe('COMPLETED')
    expect(store.loadTasks().alsoPush?.status).toBe('COMPLETED')
  })
})

describe('the gates are the same gates', () => {
  it('holds a mutating task in OBSERVE_ONLY even with room in the batch', async () => {
    const store = new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-parallel-')))
    store.startRun({ hardStop: HARD_STOP, mode: 'OBSERVE_ONLY', now: T0 })
    store.upsertTask({ id: 'push', order: 1, handler: 'h', mutating: true })
    store.upsertTask({ id: 'read', order: 2, handler: 'h' })

    const ran: string[] = []
    const engine = new LoopEngine({
      store, now: () => T0,
      handlers: { h: async ({ task }: any) => { ran.push(task.id); return { ok: true } } },
      limits: { ...DEFAULT_LIMITS, maxConcurrentTasks: 3 },
    })

    const decisions = await engine.run({ maxTicks: 5 })

    // The batcher gets no say in this: `selectEligibleTask` already filters a
    // mutating task out while mutation dispatch is closed, so room in the batch
    // cannot let one through. The read still runs.
    expect(ran).toEqual(['read'])
    expect(store.loadTasks().push?.status).toBe('QUEUED')
    expect(decisions.at(-1)?.outcome).toBe('MUTATION_BLOCKED')
  })

  it('never batches a task whose dependency has not completed', async () => {
    const store = programme([
      { id: 'first', order: 1, handler: 'h' },
      { id: 'second', order: 2, handler: 'h', dependencies: ['first'] },
    ])
    const { started, releaseAll, handler } = gated()
    const engine = new LoopEngine({
      store, now: () => T0, handlers: { h: handler },
      limits: { ...DEFAULT_LIMITS, maxConcurrentTasks: 3 },
    })

    const batch = engine.tickBatch()
    await Promise.resolve()

    // Dependency safety comes from selectEligibleTask rather than from a second
    // check in the batcher: nothing eligible can depend on anything else that is.
    expect(started).toEqual(['first'])
    releaseAll()
    await batch
  })

  it('marks every task RUNNING before awaiting any of them, so a crash is reconcilable', async () => {
    const store = programme([
      { id: 'a', order: 1, handler: 'h' },
      { id: 'b', order: 2, handler: 'h' },
    ])
    const { releaseAll, handler } = gated()
    const engine = new LoopEngine({
      store, now: () => T0, handlers: { h: handler },
      limits: { ...DEFAULT_LIMITS, maxConcurrentTasks: 2 },
    })

    const batch = engine.tickBatch()
    await Promise.resolve()

    // The supervisor's reconciler reads this mark. A task dispatched but not
    // marked is one it cannot put right after a crash.
    expect(store.loadTasks().a?.status).toBe('RUNNING')
    expect(store.loadTasks().b?.status).toBe('RUNNING')
    releaseAll()
    await batch
  })

})

/**
 * A batch where one dispatch fails outright rather than returning `ok: false`.
 *
 * `#dispatch` guards the handler call, so a handler that throws is a normal
 * failure. What is not guarded is the state writes around it — the transition
 * to RUNNING, and every write in `#settle`. A full or unwritable state
 * directory throws there, and so does any status a handler returns that is not
 * a known task state. This is that failure.
 */
function failingSettle(store: ControlPlaneStore, taskId: string, message: string) {
  const real = store.recordAttempt.bind(store)
  store.recordAttempt = ((id: string, options: unknown) => {
    if (id === taskId) throw new Error(message)
    return real(id, options as never)
  }) as typeof store.recordAttempt
}

/** Let the batch dispatch and any immediate handler settle. */
async function settleMicrotasks(turns = 20) {
  for (let i = 0; i < turns; i += 1) await Promise.resolve()
}

describe('a batch that fails does not abandon the tasks it is still running', () => {
  it('waits for every dispatch before reporting the failure', async () => {
    const store = programme([
      { id: 'slow', order: 1, handler: 'h' },
      { id: 'fast', order: 2, handler: 'h' },
    ])
    failingSettle(store, 'fast', 'ENOSPC: no space left on device, write')

    let slowFinished = false
    let releaseSlow: () => void = () => {}
    const slowGate = new Promise<void>((r) => { releaseSlow = r })
    const engine = new LoopEngine({
      store, now: () => T0,
      handlers: {
        h: async ({ task }: any) => {
          if (task.id === 'fast') return { ok: true }
          await slowGate
          slowFinished = true
          return { ok: true }
        },
      },
      limits: { ...DEFAULT_LIMITS, maxConcurrentTasks: 2 },
    })

    let state = 'pending'
    const batch = engine.tickBatch()
    batch.then(() => { state = 'resolved' }, () => { state = 'rejected' })
    await settleMicrotasks()

    // `Promise.all` would have handed the rejection back here, with `slow` still
    // in flight and still marked RUNNING. The engine owns that dispatch until it
    // finishes; it does not get to disown it early.
    expect(state).toBe('pending')
    expect(slowFinished).toBe(false)

    releaseSlow()
    await expect(batch).rejects.toThrow(/ENOSPC/)

    // The failure still propagates — it is not swallowed, and the batch is not
    // reported as a success — but only once nothing of it is still running.
    expect(slowFinished).toBe(true)
  })

  it('holds the writer lane until the batch it started has drained', async () => {
    const store = programme([
      { id: 'slow', order: 1, handler: 'h' },
      { id: 'fast', order: 2, handler: 'h' },
    ])
    failingSettle(store, 'fast', 'EIO: i/o error, write')

    let releaseSlow: () => void = () => {}
    const slowGate = new Promise<void>((r) => { releaseSlow = r })
    const engine = new LoopEngine({
      store, now: () => T0,
      handlers: {
        h: async ({ task }: any) => {
          if (task.id === 'fast') return { ok: true }
          await slowGate
          return { ok: true }
        },
      },
      limits: { ...DEFAULT_LIMITS, maxConcurrentTasks: 2 },
    })

    const supervisor = new Supervisor({
      store, engine, now: () => T0, sleep: async () => {},
      holder: 'first', maxPasses: 1,
    })
    const run = supervisor.run().catch((error: unknown) => error)
    await settleMicrotasks()

    // The supervisor releases the lease in a `finally`. If the batch rejects
    // while `slow` is still running, the lane frees with a live handler behind
    // it: a second supervisor takes it, reads `slow`'s RUNNING mark as a dead
    // process's leftover and reconciles it, and then the abandoned handler
    // settles the same task. Two writers, which is what the lease exists to
    // prevent.
    expect(store.loadTasks().slow?.status).toBe('RUNNING')
    expect(store.acquireLease('second', { at: T0 }).acquired).toBe(false)

    releaseSlow()
    expect(await run).toBeInstanceOf(Error)

    // Held until the batch drained, then released — not held forever.
    expect(store.acquireLease('second', { at: T0 }).acquired).toBe(true)
  })
})
