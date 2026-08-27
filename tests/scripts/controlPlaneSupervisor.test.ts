import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SLEEPS,
  Supervisor,
  reconcileInterruptedTasks,
} from '../../scripts/control-plane/supervisor.mjs'
import { ControlPlaneStore } from '../../scripts/control-plane/state.mjs'

const HARD_STOP = '2026-08-27T00:00:00.000Z'
const T0 = '2026-08-26T00:00:00.000Z'

function freshStore() {
  return new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-supervisor-')))
}

/** A clock that only moves when something asks it to. */
function clock(start = T0) {
  let at = Date.parse(start)
  return {
    now: () => new Date((at += 1000)).toISOString(),
    advance: (ms: number) => { at += ms },
  }
}

/** A sleep that records rather than waits. */
function recordingSleep(time: { advance: (ms: number) => void }) {
  const slept: number[] = []
  return {
    slept,
    sleep: async (ms: number) => { slept.push(ms); time.advance(ms) },
  }
}

describe('reconciling what a crash left behind', () => {
  it('re-queues an interrupted read, because gathering evidence again costs nothing', () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'look', order: 1, handler: 'read', mutating: false })
    store.transition('look', 'RUNNING', { at: time.now(), evidence: 'dispatch read' })

    const reconciled = reconcileInterruptedTasks(store, { at: time.now() })

    expect(reconciled).toEqual([{ id: 'look', to: 'QUEUED', reason: expect.stringContaining('mid-read') }])
    expect(store.loadTasks().look?.status).toBe('QUEUED')
    expect(store.loadTasks().look?.blocker).toBe(null)
  })

  it('parks an interrupted mutation, because one interrupted pr.create is two pull requests', () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'open-pr', order: 1, handler: 'pr', mutating: true })
    store.transition('open-pr', 'RUNNING', { at: time.now(), evidence: 'dispatch pr' })

    reconcileInterruptedTasks(store, { at: time.now() })

    const task = store.loadTasks()['open-pr']
    expect(task?.status).toBe('WAITING_OWNER')
    expect(task?.blocker).toBe('INTERRUPTED_MUTATION')
    expect(task?.nextAction).toContain('confirm whether the mutation landed')
  })

  it('leaves every other state alone', () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    for (const [id, status] of [['a', 'QUEUED'], ['b', 'WAITING_CI'], ['c', 'COMPLETED'], ['d', 'BLOCKED']] as const) {
      store.upsertTask({ id, order: 1, handler: 'h' })
      if (status !== 'QUEUED') store.transition(id, status, { at: time.now() })
    }

    expect(reconcileInterruptedTasks(store, { at: time.now() })).toEqual([])
    expect(store.loadTasks().b?.status).toBe('WAITING_CI')
  })

  it('runs before the first tick, so the scheduler never sees a stale RUNNING', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'open-pr', order: 1, handler: 'pr', mutating: true })
    store.transition('open-pr', 'RUNNING', { at: time.now(), evidence: 'dispatch pr' })

    const dispatched: string[] = []
    const supervisor = new Supervisor({
      store, now: time.now, sleep, maxPasses: 1,
      handlers: { pr: async ({ task }: any) => { dispatched.push(task.id); return { ok: true } } },
    })

    const result = await supervisor.run()

    // Without reconciliation this task is eligible — RUNNING is neither
    // terminal nor waiting — and the handler runs a second time.
    expect(dispatched).toEqual([])
    expect(result.reconciled.map((entry) => entry.id)).toEqual(['open-pr'])
  })
})

describe('the writer lane', () => {
  it('is taken before the first tick and released on the way out', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    await new Supervisor({ store, now: time.now, sleep, holder: 'first' }).run()

    // Released, so the next supervisor is free to take it.
    expect(store.acquireLease('second', { at: time.now() }).acquired).toBe(true)
  })

  it('refuses to start while another supervisor holds it', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep, slept } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'work', order: 1, handler: 'h' })
    store.acquireLease('the-other-one', { at: time.now(), ttlMs: 60 * 60 * 1000 })

    const dispatched: string[] = []
    const result = await new Supervisor({
      store, now: time.now, sleep, holder: 'me',
      handlers: { h: async ({ task }: any) => { dispatched.push(task.id); return { ok: true } } },
    }).run()

    // Not an error: two supervisors interleaving is the failure the lease
    // exists to prevent, so the second one stands down.
    expect(result.outcome).toBe('LEASE_HELD')
    expect(dispatched).toEqual([])
    expect(slept).toEqual([])
    expect(store.loadTasks().work?.status).toBe('QUEUED')
  })

  it('renews before sleeping, so the lease never lapses mid-wait', async () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'parked', order: 1, handler: 'park' })

    // Checked DURING each wait, not after the run: the supervisor releases the
    // lane on its way out, so anything asserted afterwards passes either way.
    // The moment that matters is the lane sitting idle while its holder sleeps.
    const stolenDuringSleep: boolean[] = []
    const sleep = async (ms: number) => {
      time.advance(ms - 1)
      stolenDuringSleep.push(store.acquireLease('someone-else', { at: time.now() }).acquired)
      time.advance(1)
    }

    await new Supervisor({
      store, now: time.now, sleep, holder: 'me', maxPasses: 2, leaseTtlMs: 60_000,
      sleeps: { ...DEFAULT_SLEEPS, WAITING_EXTERNAL: 45_000 },
      handlers: {
        // A pass that takes real time — observing CI, running a test, waiting on
        // a network read. This is what makes the ordering matter: renewing
        // AFTER the sleep asks one lease to cover the pass and the wait
        // together, and 50s of work plus a 45s wait does not fit in 60s.
        // Renewing before the wait only ever has to cover the wait.
        park: async () => {
          time.advance(50_000)
          return { ok: true, status: 'WAITING_CI', evidence: 'parked' }
        },
      },
    }).run()

    expect(stolenDuringSleep).toEqual([false, false])
  })
})

/** Let a supervisor reach the inside of its first pass. */
async function flush(turns = 20) {
  for (let i = 0; i < turns; i += 1) await Promise.resolve()
}

/**
 * Two supervisors on one machine.
 *
 * Every other lease test hands out its holders by name — `'first'`/`'second'`,
 * `'me'`/`'someone-else'` — which is the one thing production never does.
 * `cli.mjs` constructs `Supervisor` with no `holder` at all, so the default is
 * the whole of what separates one live writer from another, and two of them on
 * one host is not an exotic configuration: it is `supervise` typed twice.
 */
describe('two supervisors on the same host', () => {
  it('gives independently started supervisors different writer identities', () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    // Built the way `cli.mjs` builds them: no holder passed.
    const a = new Supervisor({ store, now: time.now, sleep: async () => {} })
    const b = new Supervisor({ store, now: time.now, sleep: async () => {} })

    expect(a.holder).not.toBe(b.holder)
    // Still legible in a lease file and a log line, not an opaque token.
    expect(a.holder).toContain('supervisor@')
  })

  it('refuses the lane to a second supervisor that shares the default holder', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'push', order: 1, handler: 'h', mutating: true })

    // A is inside its pass, holding the lane, its mutating handler still live.
    let releaseA: () => void = () => {}
    const aGate = new Promise<void>((r) => { releaseA = r })
    let aStarted = false
    const a = new Supervisor({
      store, now: time.now, sleep, maxPasses: 1,
      handlers: { h: async () => { aStarted = true; await aGate; return { ok: true } } },
    })
    const aRun = a.run()
    await flush()

    expect(aStarted).toBe(true)
    expect(store.loadTasks().push?.status).toBe('RUNNING')

    // B starts on the same host, the same way, while A is still working.
    const bDispatched: string[] = []
    const bResult = await new Supervisor({
      store, now: time.now, sleep, maxPasses: 1,
      handlers: { h: async ({ task }: any) => { bDispatched.push(task.id); return { ok: true } } },
    }).run()

    // Holder equality is what `acquireLease` gates on, and it is the same gate
    // that lets a supervisor renew its own lease. Two processes presenting one
    // identity therefore both read as the incumbent renewing, and both proceed.
    expect(bResult.outcome).toBe('LEASE_HELD')

    // The damage is not that B ran, but what B does on the way in: it
    // reconciles, and `push` is RUNNING because A is running it. Parking a live
    // mutation as INTERRUPTED_MUTATION is the reconciler doing its job against
    // a premise that is false.
    expect(bResult.reconciled).toEqual([])
    expect(bDispatched).toEqual([])
    expect(store.loadTasks().push?.status).toBe('RUNNING')

    releaseA()
    await aRun
  })

  it('still lets one supervisor renew its own lease, which is the same code path', () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    // `supervisor.mjs` renews by re-acquiring under its own holder before every
    // sleep. Same-holder re-acquisition is deliberate, and separating two
    // processes must not cost it.
    const mine = 'supervisor@host#1234.abcd'
    expect(store.acquireLease(mine, { at: time.now(), ttlMs: 60_000 }).acquired).toBe(true)
    expect(store.acquireLease(mine, { at: time.now(), ttlMs: 60_000 }).acquired).toBe(true)
    expect(store.acquireLease('someone-else', { at: time.now() }).acquired).toBe(false)
  })

  it('frees the lane by expiry when a holder dies without releasing', () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    const dead = 'supervisor@host#999.dead'
    const at = time.now()
    store.acquireLease(dead, { at, ttlMs: 60_000 })

    // Still inside the TTL: the lane belongs to a process that is not coming
    // back, and nobody may take it yet.
    const midway = new Date(Date.parse(at) + 30_000).toISOString()
    expect(store.acquireLease('supervisor@host#1000.new', { at: midway }).acquired).toBe(false)

    // Past it: a crashed holder frees the lane by time, with no human involved.
    const after = new Date(Date.parse(at) + 60_001).toISOString()
    expect(store.acquireLease('supervisor@host#1000.new', { at: after }).acquired).toBe(true)
  })
})

describe('passes continue until a reason that is really a reason', () => {
  it('keeps going through an external wait instead of returning to a human', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep, slept } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'parked', order: 1, handler: 'park' })

    const result = await new Supervisor({
      store, now: time.now, sleep, maxPasses: 3,
      handlers: { park: async () => ({ ok: true, status: 'WAITING_CI', evidence: 'awaiting CI' }) },
    }).run()

    // A batch loop stops here and waits for someone to type `run` again.
    expect(result.passes.map((pass) => pass.outcome)).toEqual([
      'WAITING_EXTERNAL', 'WAITING_EXTERNAL', 'WAITING_EXTERNAL',
    ])
    expect(slept).toEqual([DEFAULT_SLEEPS.WAITING_EXTERNAL, DEFAULT_SLEEPS.WAITING_EXTERNAL, DEFAULT_SLEEPS.WAITING_EXTERNAL])
  })

  it('waits longer on the owner than on CI, because looking again does not summon anyone', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep, slept } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'ask', order: 1, handler: 'ask' })

    await new Supervisor({
      store, now: time.now, sleep, maxPasses: 1,
      handlers: { ask: async () => ({ ok: true, status: 'WAITING_OWNER', evidence: 'needs a decision' }) },
    }).run()

    expect(slept).toEqual([DEFAULT_SLEEPS.WAITING_OWNER])
    expect(DEFAULT_SLEEPS.WAITING_OWNER).toBeGreaterThan(DEFAULT_SLEEPS.WAITING_EXTERNAL)
  })

  it('stops when the work is done', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep, slept } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'work', order: 1, handler: 'h' })

    const result = await new Supervisor({
      store, now: time.now, sleep, maxPasses: 5,
      handlers: { h: async () => ({ ok: true, evidence: 'done' }) },
    }).run()

    expect(result.outcome).toBe('ALL_COMPLETE')
    expect(slept).toEqual([])
  })

  it('stops on the brake, without dispatching anything first', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'work', order: 1, handler: 'h', mutating: true })
    store.setEmergencyStop(true, time.now(), 'operator')

    const dispatched: string[] = []
    const result = await new Supervisor({
      store, now: time.now, sleep, maxPasses: 5,
      handlers: { h: async ({ task }: any) => { dispatched.push(task.id); return { ok: true } } },
    }).run()

    expect(result.outcome).toBe('EMERGENCY_STOP')
    expect(dispatched).toEqual([])
  })

  it('stops at the hard stop even with work still queued', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep } = recordingSleep(time)
    store.startRun({ hardStop: '2026-08-26T00:10:00.000Z', mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'work', order: 1, handler: 'h' })
    time.advance(20 * 60 * 1000)

    const result = await new Supervisor({
      store, now: time.now, sleep, maxPasses: 5,
      handlers: { h: async () => ({ ok: true }) },
    }).run()

    expect(result.outcome).toBe('HARD_STOP')
    expect(store.loadTasks().work?.status).toBe('QUEUED')
  })
})
