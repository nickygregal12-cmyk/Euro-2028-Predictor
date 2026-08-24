import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_LIMITS,
  assessLiveness,
  classifyFailure,
  dependenciesSatisfied,
  evaluateMergeEligibility,
  mutationDispatchAllowed,
  nextStateForPullRequest,
  selectEligibleTask,
} from '../../scripts/control-plane/policy.mjs'
import { ControlPlaneStore } from '../../scripts/control-plane/state.mjs'
import { LoopEngine } from '../../scripts/control-plane/loop.mjs'
import { mergeGuard, normalisePullRequest, triagePullRequest } from '../../scripts/control-plane/github.mjs'

type Task = import('../../scripts/control-plane/policy.mjs').Task
type HandlerContext = { task: { id: string }; at: string }

const T0 = '2026-08-24T22:00:00.000Z'
const HARD_STOP = '2026-08-25T06:00:00.000Z'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'predictor-control-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function freshRun(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-1',
    startedAt: T0,
    hardStop: HARD_STOP,
    mode: 'ACTIVE',
    lastProgressAt: T0,
    noProgressCycles: 0,
    emergencyStop: false,
    pullRequestsOpened: 0,
    maxPullRequests: 8,
    ...overrides,
  }
}

describe('dependency and eligibility policy', () => {
  it('treats only COMPLETED dependencies as satisfied', () => {
    const tasks: Record<string, Task> = {
      a: { id: 'a', status: 'WAITING_OWNER' },
      b: { id: 'b', status: 'COMPLETED' },
    }
    expect(dependenciesSatisfied({ id: 'c', dependencies: ['b'] }, tasks)).toBe(true)
    // A stage parked on the owner must never unblock what genuinely needs it.
    expect(dependenciesSatisfied({ id: 'c', dependencies: ['a'] }, tasks)).toBe(false)
    expect(dependenciesSatisfied({ id: 'c', dependencies: ['a', 'b'] }, tasks)).toBe(false)
  })

  it('selects the lowest-order runnable task and skips parked ones', () => {
    const tasks: Task[] = [
      { id: 'later', status: 'QUEUED', order: 2, dependencies: [] },
      { id: 'parked', status: 'WAITING_CI', order: 0, dependencies: [] },
      { id: 'first', status: 'QUEUED', order: 1, dependencies: [] },
    ]
    expect(selectEligibleTask(freshRun(), tasks)?.id).toBe('first')
  })

  it('never dispatches a mutating task while dispatch is closed', () => {
    const tasks: Task[] = [
      { id: 'mutate', status: 'QUEUED', order: 0, dependencies: [], mutating: true },
    ]
    expect(selectEligibleTask(freshRun({ mode: 'OBSERVE_ONLY' }), tasks)).toBeNull()
    expect(selectEligibleTask(freshRun({ emergencyStop: true }), tasks)).toBeNull()
    expect(selectEligibleTask(freshRun(), tasks)?.id).toBe('mutate')
  })
})

describe('safety brakes', () => {
  it('closes mutation dispatch on stop, mode, hard stop and PR budget', () => {
    expect(mutationDispatchAllowed(freshRun()).allowed).toBe(true)
    expect(mutationDispatchAllowed(freshRun({ emergencyStop: true }))).toEqual({
      allowed: false,
      reason: 'EMERGENCY_STOP',
    })
    expect(mutationDispatchAllowed(freshRun({ mode: 'OBSERVE_ONLY' })).reason).toBe('OBSERVE_ONLY')
    expect(
      mutationDispatchAllowed(freshRun({ now: '2026-08-25T07:00:00.000Z' })).reason,
    ).toBe('HARD_STOP')
    expect(mutationDispatchAllowed(freshRun({ pullRequestsOpened: 8 })).reason).toBe(
      'PR_BUDGET_EXHAUSTED',
    )
  })

  it('escalates to BLOCKED only after the no-progress cycle limit', () => {
    const stalled = '2026-08-24T22:20:00.000Z'
    expect(assessLiveness(freshRun(), '2026-08-24T22:05:00.000Z').verdict).toBe('LIVE')
    expect(assessLiveness(freshRun(), stalled).verdict).toBe('STALLED')
    expect(assessLiveness(freshRun({ noProgressCycles: 1 }), stalled).verdict).toBe('BLOCKED')
  })
})

describe('failure classification', () => {
  it('never infers a flake from a failure alone', () => {
    const signal = { name: 'ci', output: 'Error: expected true to be false' }
    expect(classifyFailure(signal)).toBe('BRANCH_TEST_FAILURE')
    expect(classifyFailure({ ...signal, previouslyGreenOnSameSha: true })).toBe('FLAKY_TEST')
    expect(classifyFailure({ ...signal, redOnBase: true })).toBe('INHERITED_FAILURE')
  })

  it('separates host and provider limits from source defects', () => {
    expect(classifyFailure({ name: 'build', output: 'Killed: out of memory' })).toBe(
      'HOST_RESOURCE_LIMIT',
    )
    expect(classifyFailure({ name: 'ci', output: 'HTTP 429 rate limit' })).toBe('PROVIDER_LIMIT')
    expect(classifyFailure({ name: 'ci', output: '503 service unavailable' })).toBe('PROVIDER_OUTAGE')
    expect(classifyFailure({ name: 'x', policyDenied: true })).toBe('POLICY_DENIAL')
    expect(classifyFailure({ name: 'x', hostUnreachable: true })).toBe('HOST_UNREACHABLE')
    expect(classifyFailure({ name: 'mystery', output: 'something odd' })).toBe('UNKNOWN')
  })
})

describe('merge eligibility is decided from GitHub state, not assertion', () => {
  const greenPr = {
    state: 'open',
    draft: false,
    merged: false,
    mergeable: true,
    requiredChecks: [{ name: 'ci', status: 'completed', conclusion: 'success' }],
    reviewThreads: [],
    reviews: [],
  }

  it('accepts a genuinely green pull request', () => {
    expect(evaluateMergeEligibility(greenPr)).toEqual({ eligible: true, blockers: [] })
  })

  it('fails closed when a required decider never reported', () => {
    const pr = normalisePullRequest(
      { number: 1, state: 'open', checkRuns: [{ name: 'ci', status: 'completed', conclusion: 'success' }] },
      { requiredCheckNames: ['ci', 'migration-safety'] },
    )
    const verdict = evaluateMergeEligibility(pr)
    expect(verdict.eligible).toBe(false)
    expect(verdict.blockers).toContain('check_missing_decider:migration-safety')
  })

  it('treats a cancelled required check as a failure, not a pass', () => {
    const verdict = evaluateMergeEligibility({
      ...greenPr,
      requiredChecks: [{ name: 'ci', status: 'completed', conclusion: 'cancelled' }],
    })
    expect(verdict.eligible).toBe(false)
    expect(verdict.blockers).toContain('check_cancelled:ci')
  })

  it('refuses to call mergeability confirmed when GitHub has not computed it', () => {
    // GitHub reports mergeable: null / mergeable_state: 'unknown' while it works
    // the answer out. Inferring from mergeable_state made 'unknown' mergeable.
    const pending = normalisePullRequest(
      {
        number: 9,
        state: 'open',
        mergeable: null,
        mergeable_state: 'unknown',
        checkRuns: [{ name: 'ci', status: 'completed', conclusion: 'success' }],
      },
      { requiredCheckNames: ['ci'] },
    )
    expect(pending.mergeable).toBeUndefined()
    const verdict = evaluateMergeEligibility(pending)
    expect(verdict.eligible).toBe(false)
    expect(verdict.blockers).toContain('mergeability_unconfirmed')
  })

  it('does not treat a non-dirty mergeable_state as a confirmed merge', () => {
    const blocked = normalisePullRequest(
      { number: 10, state: 'open', mergeable_state: 'blocked', checkRuns: [] },
      { requiredCheckNames: [] },
    )
    expect(blocked.mergeable).toBeUndefined()
    expect(evaluateMergeEligibility(blocked).eligible).toBe(false)
  })

  it('routes every non-pending check conclusion to repair, not only failure', () => {
    // The blocker vocabulary is check_<conclusion>:, so naming just failure and
    // cancelled left skipped and timed_out waiting on nothing.
    for (const conclusion of ['skipped', 'timed_out', 'action_required', 'stale']) {
      const next = nextStateForPullRequest({
        ...greenPr,
        requiredChecks: [{ name: 'ci', status: 'completed', conclusion }],
      })
      expect(next, conclusion).toMatchObject({ status: 'ELIGIBLE', nextAction: 'REPAIR_CI' })
    }
  })

  it('routes a required decider that never reported to repair rather than a wait', () => {
    const pr = normalisePullRequest(
      { number: 11, state: 'open', mergeable: true, checkRuns: [] },
      { requiredCheckNames: ['migration-safety'] },
    )
    expect(nextStateForPullRequest(pr)).toMatchObject({ nextAction: 'REPAIR_CI' })
  })

  it('blocks on an unresolved actionable review thread even with green CI', () => {
    const verdict = evaluateMergeEligibility({
      ...greenPr,
      reviewThreads: [{ isResolved: false, isOutdated: false }],
    })
    expect(verdict.eligible).toBe(false)
    expect(verdict.blockers).toContain('unresolved_review_threads:1')
  })

  it('ignores resolved and outdated threads', () => {
    expect(
      evaluateMergeEligibility({
        ...greenPr,
        reviewThreads: [{ isResolved: true, isOutdated: false }, { isResolved: false, isOutdated: true }],
      }).eligible,
    ).toBe(true)
  })

  it('blocks when base drift invalidates the evidence', () => {
    const pr = normalisePullRequest(
      { number: 2, state: 'open', base: { sha: 'old' }, checkRuns: [] },
      { requiredCheckNames: ['ci'], baseSha: 'new' },
    )
    expect(evaluateMergeEligibility(pr).blockers).toContain('base_drift_invalidates_evidence')
  })

  it('parks a pending pull request in WAITING_CI rather than asking again', () => {
    const next = nextStateForPullRequest({
      ...greenPr,
      requiredChecks: [{ name: 'ci', status: 'in_progress' }],
    })
    expect(next).toMatchObject({ status: 'WAITING_CI', nextAction: 'WATCH_CI' })
  })

  it('routes a red required check to repair', () => {
    const next = nextStateForPullRequest({
      ...greenPr,
      requiredChecks: [{ name: 'ci', status: 'completed', conclusion: 'failure' }],
    })
    expect(next).toMatchObject({ status: 'ELIGIBLE', nextAction: 'REPAIR_CI' })
  })

  it('refuses to merge when the head moved after triage', () => {
    const triage = triagePullRequest(
      normalisePullRequest(
        {
          number: 3,
          state: 'open',
          headSha: 'aaa',
          mergeable: true,
          checkRuns: [{ name: 'ci', status: 'completed', conclusion: 'success' }],
        },
        { requiredCheckNames: ['ci'] },
      ),
    )
    expect(mergeGuard(triage, 'aaa').allowed).toBe(true)
    expect(mergeGuard(triage, 'bbb')).toMatchObject({ allowed: false })
  })
})

describe('safety-brake inputs are validated where they are persisted', () => {
  it('refuses a hard stop that does not parse, rather than disabling the brake', () => {
    const store = new ControlPlaneStore(dir)
    // Date.parse(true) is NaN and every NaN comparison is false, so an unusable
    // hard stop would have silently allowed dispatch past the stop time.
    for (const bad of [true, undefined, 'not-a-date', '']) {
      expect(() =>
        store.startRun({ hardStop: bad as never, mode: 'ACTIVE', now: T0 }),
      ).toThrow(/parseable timestamp/)
    }
    expect(store.loadRun()).toBeNull()
  })

  it('accepts a real timestamp', () => {
    const store = new ControlPlaneStore(dir)
    expect(store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 }).hardStop).toBe(HARD_STOP)
  })
})

describe('store durability', () => {
  it('refuses to persist secret-shaped keys', () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'OBSERVE_ONLY', now: T0 })
    expect(() => store.upsertTask({ id: 't', github_token: 'x' })).toThrow(/secret-shaped/)
    expect(() => store.appendEvent({ at: T0, password: 'x' })).toThrow(/secret-shaped/)
  })

  it('reads an absent ledger as empty rather than racing an existence check', () => {
    const store = new ControlPlaneStore(dir)
    expect(store.loadRun()).toBeNull()
    expect(store.loadTasks()).toEqual({})
    expect(store.readEvents()).toEqual([])
  })

  it('enforces one writer lane until the lease expires', () => {
    const store = new ControlPlaneStore(dir)
    expect(store.acquireLease('writer-a', { at: T0 }).acquired).toBe(true)
    expect(store.acquireLease('writer-b', { at: T0 })).toMatchObject({
      acquired: false,
      heldBy: 'writer-a',
    })
    // The same holder may renew, and release frees the lane.
    expect(store.acquireLease('writer-a', { at: T0 }).acquired).toBe(true)
    store.releaseLease('writer-a', T0)
    expect(store.acquireLease('writer-b', { at: T0 }).acquired).toBe(true)
  })

  it('resumes an existing run instead of starting a second one', () => {
    const first = new ControlPlaneStore(dir).startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    const second = new ControlPlaneStore(dir).startRun({
      hardStop: HARD_STOP,
      mode: 'ACTIVE',
      now: '2026-08-24T23:00:00.000Z',
    })
    expect(second.runId).toBe(first.runId)
    expect(second.startedAt).toBe(T0)
  })

  it('counts repeated identical failures but resets on a different one', () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 't', handler: 'noop' })
    store.recordAttempt('t', { at: T0, failureClass: 'BRANCH_TEST_FAILURE' })
    store.recordAttempt('t', { at: T0, failureClass: 'BRANCH_TEST_FAILURE' })
    expect(store.loadTasks().t?.repeatedFailures).toBe(1)
    store.recordAttempt('t', { at: T0, failureClass: 'CI_INFRA_FAILURE' })
    expect(store.loadTasks().t?.repeatedFailures).toBe(0)
  })
})

describe('loop bootstrap canary', () => {
  const clock = () => {
    let tick = 0
    return () => new Date(Date.parse(T0) + tick++ * 1000).toISOString()
  }

  function seedThreeTasks(store: ControlPlaneStore) {
    store.upsertTask({ id: 'A', handler: 'ok', order: 0, dependencies: [] })
    store.upsertTask({ id: 'B', handler: 'ok', order: 1, dependencies: ['A'] })
    store.upsertTask({ id: 'C', handler: 'ok', order: 2, dependencies: ['B'] })
  }

  it('sequences three dependent tasks with no instruction to continue', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    seedThreeTasks(store)

    const ran: string[] = []
    const engine = new LoopEngine({
      store,
      now: clock(),
      handlers: {
        ok: async ({ task }: HandlerContext) => {
          ran.push(task.id)
          return { ok: true, evidence: `${task.id} done` }
        },
      },
    })

    const decisions = await engine.run()
    expect(ran).toEqual(['A', 'B', 'C'])
    expect(decisions.at(-1)?.outcome).toBe('ALL_COMPLETE')
    expect(store.listTasks().every((t) => t.status === 'COMPLETED')).toBe(true)
  })

  it('stops a fourth mutating dispatch once Emergency Stop is engaged', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    seedThreeTasks(store)
    store.upsertTask({ id: 'D', handler: 'ok', order: 3, dependencies: ['C'], mutating: true })

    const ran: string[] = []
    const engine = new LoopEngine({
      store,
      now: clock(),
      handlers: {
        ok: async ({ task }: HandlerContext) => {
          ran.push(task.id)
          if (task.id === 'C') store.setEmergencyStop(true, T0, 'canary')
          return { ok: true, evidence: `${task.id} done` }
        },
      },
    })

    await engine.run()
    expect(ran).toEqual(['A', 'B', 'C'])
    expect(ran).not.toContain('D')
    expect(store.loadTasks().D?.status).not.toBe('COMPLETED')
  })

  it('recovers from a process restart using the persisted checkpoint', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    seedThreeTasks(store)

    const firstProcess = new LoopEngine({
      store,
      now: clock(),
      handlers: {
        ok: async ({ task, at }: HandlerContext) => ({
          ok: true,
          evidence: `${task.id} done`,
          checkpoint: { at, completed: task.id, sha: `sha-${task.id}` },
        }),
      },
    })
    // Simulate the process dying after exactly one task.
    await firstProcess.tick()
    expect(store.loadTasks().A?.status).toBe('COMPLETED')

    // A brand new store object: nothing carried in memory from the first run.
    const revived = new ControlPlaneStore(dir)
    expect(revived.getCheckpoint('A')).toMatchObject({ completed: 'A', sha: 'sha-A' })
    expect(revived.loadRun()?.runId).toBe(store.loadRun()?.runId)

    const ran: string[] = []
    const secondProcess = new LoopEngine({
      store: revived,
      now: clock(),
      handlers: {
        ok: async ({ task }: HandlerContext) => {
          ran.push(task.id)
          return { ok: true, evidence: `${task.id} done` }
        },
      },
    })
    await secondProcess.run()
    // A is not redone; the loop resumes where the checkpoint left it.
    expect(ran).toEqual(['B', 'C'])
  })

  it('blocks a task after the attempt limit instead of retrying forever', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'flaky', handler: 'fail', order: 0 })

    let calls = 0
    const engine = new LoopEngine({
      store,
      now: clock(),
      handlers: {
        fail: async () => {
          calls += 1
          return { ok: false, failureClass: 'BRANCH_TEST_FAILURE', evidence: 'red' }
        },
      },
    })

    await engine.run()
    // maxRepeatedIdenticalFailures (2) trips before maxAttemptsPerTask (3).
    expect(calls).toBeLessThanOrEqual(DEFAULT_LIMITS.maxAttemptsPerTask)
    expect(store.loadTasks().flaky?.status).toBe('BLOCKED')
  })

  it('parks a mutating task in OBSERVE_ONLY without dispatching it', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'OBSERVE_ONLY', now: T0 })
    store.upsertTask({ id: 'M', handler: 'ok', order: 0, mutating: true })
    store.upsertTask({ id: 'R', handler: 'ok', order: 1 })

    const ran: string[] = []
    const engine = new LoopEngine({
      store,
      now: clock(),
      handlers: {
        ok: async ({ task }: HandlerContext) => {
          ran.push(task.id)
          return { ok: true, evidence: 'done' }
        },
      },
    })

    await engine.run()
    // Read-only work still advances; the mutating one is left untouched.
    expect(ran).toEqual(['R'])
    expect(store.loadTasks().M?.status).toBe('QUEUED')
  })
})
