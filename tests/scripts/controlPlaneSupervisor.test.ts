import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

import {
  DEFAULT_SLEEPS,
  Supervisor,
  defaultHolder,
  reconcileInterruptedTasks,
  withWriterLease,
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

  it('stands down when a pass outlived the lease and the lane was taken', async () => {
    const store = freshStore()
    const time = clock()
    const { sleep, slept } = recordingSleep(time)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.upsertTask({ id: 'slow', order: 1, handler: 'slow' })

    // The lease is renewed between passes, never inside one. A pass that runs
    // longer than the TTL therefore expires the lane while its holder is still
    // working, and the next supervisor may legitimately take it.
    const dispatched: string[] = []
    const result = await new Supervisor({
      store, now: time.now, sleep, holder: 'mine', maxPasses: 3, leaseTtlMs: 60_000,
      handlers: {
        slow: async ({ task }: any) => {
          dispatched.push(task.id)
          time.advance(90_000)
          // Somebody else took the expired lane while this pass was running.
          store.acquireLease('theirs', { at: time.now(), ttlMs: 60_000 })
          return { ok: true, status: 'WAITING_CI', evidence: 'parked' }
        },
      },
    }).run()

    // Renewal is refused, and that refusal has to end the run. Sleeping and
    // starting another pass is this supervisor writing over the one that now
    // holds the lane — the failure the lease exists to prevent, arriving after
    // the entry check rather than before it.
    expect(result.outcome).toBe('LEASE_LOST')
    // A second pass is always preceded by a sleep, so never sleeping is the
    // observable form of "it stopped here". Note the renewal is only checked
    // BETWEEN passes: the lease is not re-checked inside `engine.run`, so
    // everything already dispatched in this pass still ran.
    expect(slept).toEqual([])
    expect(dispatched).toEqual(['slow'])

    // Leaving must not disturb the new holder: `releaseLease` refuses to write
    // when the lane belongs to somebody else.
    expect(store.acquireLease('a-third', { at: time.now() }).acquired).toBe(false)
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

/**
 * The one-shot writers.
 *
 * `Supervisor` was never the only thing driving the engine. `cli.mjs run` and
 * `canary.mjs` build a `LoopEngine` over the same state directory and drive it
 * directly, and until they took the lane it excluded supervisors from each
 * other and nobody else. `canary.mjs` is the sharp case: it calls `startRun`,
 * which resets the run a supervisor may be in the middle of, and registers
 * handlers that push branches and open pull requests.
 */
describe('holding the lane for one-shot work', () => {
  it('runs the body and gives the lane back', async () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    let ran = false
    const outcome = await withWriterLease(
      store, { holder: 'one-shot', now: time.now },
      async () => { ran = true; return 'done' },
    )

    expect(outcome).toEqual({ acquired: true, result: 'done', heldToTheEnd: true })
    expect(ran).toBe(true)
    expect(store.acquireLease('next', { at: time.now() }).acquired).toBe(true)
  })

  it('does not run the body at all when somebody else holds the lane', async () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })
    store.acquireLease('the-supervisor', { at: time.now(), ttlMs: 60 * 60 * 1000 })

    let ran = false
    const outcome = await withWriterLease(
      store, { holder: 'one-shot', now: time.now },
      async () => { ran = true },
    )

    // Refusing after doing the work would be no refusal at all.
    expect(ran).toBe(false)
    expect(outcome.acquired).toBe(false)
    expect('heldBy' in outcome && outcome.heldBy).toBe('the-supervisor')
  })

  it('gives the lane back when the body throws', async () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    await expect(withWriterLease(
      store, { holder: 'one-shot', now: time.now },
      async () => { throw new Error('push failed') },
    )).rejects.toThrow('push failed')

    // A failed run that keeps the lane locks the programme out for a whole TTL.
    expect(store.acquireLease('next', { at: time.now() }).acquired).toBe(true)
  })

  it('does not disturb a new holder that took the lane while the body ran', async () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    await withWriterLease(
      store, { holder: 'one-shot', now: time.now, ttlMs: 60_000 },
      async () => {
        // Ran long, the lane expired, somebody else legitimately took it.
        time.advance(90_000)
        store.acquireLease('theirs', { at: time.now(), ttlMs: 60_000 })
      },
    )

    // `releaseLease` declines to write when the holder is not the incumbent, so
    // leaving does not hand the lane to a third party.
    expect(store.acquireLease('a-third', { at: time.now() }).acquired).toBe(false)
  })

  it('gives each one-shot writer its own identity, named for what it is', () => {
    expect(defaultHolder('canary')).not.toBe(defaultHolder('canary'))
    expect(defaultHolder('canary')).toContain('canary@')
    expect(defaultHolder('run')).toContain('run@')
    expect(defaultHolder()).toContain('supervisor@')
  })
})

/**
 * Drive a real control-plane entry point against a scratch state directory.
 *
 * PATH is emptied deliberately. These entry points shell out to `git`, `gh` and
 * `bash`, and the whole point of the assertions below is that they stop before
 * they get there — but a test whose safety depends on the code under test being
 * correct is not a safe test. Verifying this change the first time, with the
 * gate reverted, the canary ran for real: it branched, committed, pushed and
 * opened a pull request. Emptying PATH means a regression fails the assertion
 * instead of publishing something.
 */
function runScript(script: string, args: string[], dir: string) {
  try {
    const stdout = execFileSync(process.execPath, [resolve(process.cwd(), script), ...args], {
      encoding: 'utf8',
      env: {
        PREDICTOR_CONTROL_STATE_DIR: dir,
        PREDICTOR_CONTROL_STATE_BACKEND: 'files',
        HOME: process.env.HOME ?? '',
        PATH: '',
      },
    })
    return { code: 0, stdout, stderr: '' }
  } catch (error: any) {
    return { code: error.status ?? 1, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') }
  }
}

describe('the entry points actually take the lane', () => {
  // These run the real scripts, so they are on the real clock: a lease seeded
  // at the frozen test time would already have expired, and the entry point
  // would be right to take the lane.
  const realNow = () => new Date().toISOString()
  const FAR_FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  it('cli run refuses to start while the lane is held', () => {
    const store = freshStore()
    store.startRun({ hardStop: FAR_FUTURE, mode: 'ACTIVE', now: realNow() })
    store.upsertTask({ id: 'someone-elses-work', order: 1, handler: 'git.reconcile' })
    store.acquireLease('the-supervisor', { at: realNow(), ttlMs: 60 * 60 * 1000 })

    const result = runScript('scripts/control-plane/cli.mjs', ['run'], (store as any).dir)

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('writer lane held by the-supervisor')
    // Nothing was dispatched: the queue is untouched.
    expect(store.loadTasks()['someone-elses-work']?.status).toBe('QUEUED')
  })

  it('the canary refuses to start, and does not reset the run on its way out', () => {
    const store = freshStore()
    const dir = (store as any).dir
    store.startRun({ hardStop: FAR_FUTURE, mode: 'ACTIVE', now: realNow() })
    store.upsertTask({ id: 'someone-elses-work', order: 1, handler: 'h' })
    store.acquireLease('the-supervisor', { at: realNow(), ttlMs: 60 * 60 * 1000 })
    const runBefore = store.loadRun()

    const bodyFile = resolve(dir, 'body.md')
    writeFileSync(bodyFile, 'canary body\n')
    const result = runScript('scripts/control-plane/canary.mjs', [
      '--branch', 'claude/canary', '--title', 'canary', '--body-file', bodyFile,
      '--hard-stop', FAR_FUTURE,
    ], dir)

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('writer lane held by the-supervisor')

    // The point of the gate: `startRun` never ran, so the supervisor's run
    // record and queue are exactly as they were. This is the difference
    // between a refused canary and a canary that resets somebody's programme.
    expect(store.loadRun()?.runId).toBe(runBefore?.runId)
    expect(store.listTasks().map((task) => task.id)).toEqual(['someone-elses-work'])
  })
})

describe('what a one-shot writer reports about the lane it held', () => {
  it('says it kept the lane when it did', async () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    const outcome = await withWriterLease(
      store, { holder: 'one-shot', now: time.now, ttlMs: 60_000 },
      async () => 'fine',
    )

    expect(outcome).toEqual({ acquired: true, result: 'fine', heldToTheEnd: true })
  })

  it('says it lost the lane when the body outlived the lease', async () => {
    const store = freshStore()
    const time = clock()
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: time.now() })

    const outcome = await withWriterLease(
      store, { holder: 'one-shot', now: time.now, ttlMs: 60_000 },
      async () => {
        time.advance(90_000)
        store.acquireLease('theirs', { at: time.now(), ttlMs: 60_000 })
        return 'done anyway'
      },
    )

    // The lease is never renewed mid-body, so this overlap is possible and is
    // not prevented here. What must not happen is it passing unnoticed.
    expect(outcome).toEqual({ acquired: true, result: 'done anyway', heldToTheEnd: false })
  })
})

describe('cli run on the happy path', () => {
  const realNow = () => new Date().toISOString()
  const FAR_FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  it('still prints its decisions, exits zero, and gives the lane back', () => {
    const store = freshStore()
    const dir = (store as any).dir
    store.startRun({ hardStop: FAR_FUTURE, mode: 'ACTIVE', now: realNow() })

    // Nothing queued, so the engine reports why rather than dispatching — that
    // is enough to prove the success path still reaches the printing code with
    // the lease taken and released around it.
    const result = runScript('scripts/control-plane/cli.mjs', ['run'], dir)

    expect(result.code).toBe(0)
    expect(result.stdout).toMatch(/ALL_COMPLETE|IDLE|WAITING|MUTATION_BLOCKED/)
    expect(result.stderr).not.toContain('writer lane')

    // Given back on the way out, so the next writer is not locked out for a TTL.
    expect(store.acquireLease('next', { at: realNow() }).acquired).toBe(true)
  })
})
