import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_LIMITS,
  assessLiveness,
  classifyFailure,
  countDownstream,
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

describe('a run replaced by a newer push is not a failure of this branch', () => {
  it('classifies a superseded cancellation ahead of anything in its output', () => {
    // Observed twice on PR #1044: pushing a fix mid-run left the merge gate
    // reporting `CI_RESULT: cancelled` against a commit that was no longer the
    // head. Nothing broke; the run was abandoned.
    expect(classifyFailure({ name: 'ci', output: 'CI_RESULT: cancelled', superseded: true })).toBe(
      'SUPERSEDED',
    )
    // The reason outranks the text: a superseded run whose log happens to carry
    // assertion noise is still superseded.
    expect(
      classifyFailure({ name: 'ci', output: 'expected true to be false', superseded: true }),
    ).toBe('SUPERSEDED')
  })

  it('derives it from the SHA the run measured, not from the word cancelled', () => {
    const pr = normalisePullRequest(
      {
        number: 1044,
        state: 'open',
        mergeable: true,
        headSha: 'newhead',
        checkRuns: [
          { name: 'gate', status: 'completed', conclusion: 'cancelled', head_sha: 'oldhead' },
        ],
      },
      { requiredCheckNames: ['gate'] },
    )
    expect(triagePullRequest(pr).failures[0]).toMatchObject({ failureClass: 'SUPERSEDED' })
  })

  it('still calls a cancellation on the current head a real problem', () => {
    // Cancelled while measuring this very commit is not superseded — something
    // stopped it, and that is worth a repair task.
    const pr = normalisePullRequest(
      {
        number: 1044,
        state: 'open',
        mergeable: true,
        headSha: 'samehead',
        checkRuns: [
          { name: 'gate', status: 'completed', conclusion: 'cancelled', head_sha: 'samehead' },
        ],
      },
      { requiredCheckNames: ['gate'] },
    )
    expect(triagePullRequest(pr).failures[0]?.failureClass).not.toBe('SUPERSEDED')
  })

  it('blocks the merge either way, because cancelled evidence is not a pass', () => {
    const pr = normalisePullRequest(
      {
        number: 1044,
        state: 'open',
        mergeable: true,
        headSha: 'newhead',
        checkRuns: [
          { name: 'gate', status: 'completed', conclusion: 'cancelled', head_sha: 'oldhead' },
        ],
      },
      { requiredCheckNames: ['gate'] },
    )
    expect(evaluateMergeEligibility(pr).blockers).toContain('check_cancelled:gate')
  })

  it('waits for the new head rather than queuing repair work for a push', () => {
    const pr = normalisePullRequest(
      {
        number: 1044,
        state: 'open',
        mergeable: true,
        headSha: 'newhead',
        checkRuns: [
          { name: 'gate', status: 'completed', conclusion: 'cancelled', head_sha: 'oldhead' },
        ],
      },
      { requiredCheckNames: ['gate'] },
    )
    const triage = triagePullRequest(pr)
    // Classifying it but still routing to REPAIR_CI would manufacture work out
    // of a push, which is the whole thing this avoids.
    expect(triage).toMatchObject({ status: 'WAITING_CI', nextAction: 'WATCH_CI' })
    expect(triage.mergeEligible).toBe(false)
  })

  it('still repairs when a real failure sits alongside a superseded one', () => {
    const pr = normalisePullRequest(
      {
        number: 1044,
        state: 'open',
        mergeable: true,
        headSha: 'newhead',
        checkRuns: [
          { name: 'gate', status: 'completed', conclusion: 'cancelled', head_sha: 'oldhead' },
          { name: 'tests', status: 'completed', conclusion: 'failure', head_sha: 'newhead' },
        ],
      },
      { requiredCheckNames: ['gate', 'tests'] },
    )
    expect(triagePullRequest(pr).nextAction).toBe('REPAIR_CI')
  })

  it('reads the run SHA whichever shape the caller reports it in', () => {
    // The PR head is already accepted as `head.sha` or `headSha`; a check run
    // read through a camelCase client had no such tolerance, so its SHA came
    // back undefined, the run classified UNKNOWN, and the push it was cancelled
    // by became repair work — the very thing this classification prevents.
    for (const shape of [{ head_sha: 'oldhead' }, { headSha: 'oldhead' }, { runSha: 'oldhead' }]) {
      const pr = normalisePullRequest(
        {
          number: 1046,
          state: 'open',
          mergeable: true,
          headSha: 'newhead',
          checkRuns: [{ name: 'gate', status: 'completed', conclusion: 'cancelled', ...shape }],
        },
        { requiredCheckNames: ['gate'] },
      )
      expect(triagePullRequest(pr).failures[0], JSON.stringify(shape)).toMatchObject({
        failureClass: 'SUPERSEDED',
      })
    }
  })

  it('does not let a superseded run hide a reviewer waiting on an answer', () => {
    // Waiting on CI was once asserted for the whole pull request the moment its
    // only failing check was superseded. A changes-requested review then sat
    // behind a push, watching runs that were never the blocking item.
    const pr = normalisePullRequest(
      {
        number: 1046,
        state: 'open',
        mergeable: true,
        headSha: 'newhead',
        checkRuns: [
          { name: 'gate', status: 'completed', conclusion: 'cancelled', head_sha: 'oldhead' },
        ],
        reviews: [{ state: 'CHANGES_REQUESTED' }],
      },
      { requiredCheckNames: ['gate'] },
    )
    const triage = triagePullRequest(pr)
    expect(triage).toMatchObject({ status: 'ELIGIBLE', nextAction: 'ADDRESS_REVIEW' })
    // The correction is to the routing only. Cancelled evidence is still not a
    // pass, so the merge verdict must report the conclusion actually observed.
    expect(triage.blockers).toContain('check_cancelled:gate')
    expect(triage.mergeEligible).toBe(false)
  })

  it('does not let a superseded run hide a base the branch has drifted from', () => {
    const pr = normalisePullRequest(
      {
        number: 1046,
        state: 'open',
        mergeable: false,
        headSha: 'newhead',
        base: { sha: 'old' },
        checkRuns: [
          { name: 'gate', status: 'completed', conclusion: 'cancelled', head_sha: 'oldhead' },
        ],
      },
      { requiredCheckNames: ['gate'], baseSha: 'new' },
    )
    expect(triagePullRequest(pr).nextAction).toBe('MERGE_BASE')
  })

  it('spends no attempt and no stall credit on a superseded run', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'A', handler: 'superseded', order: 0 })

    let calls = 0
    const engine = new LoopEngine({
      store,
      now: () => T0,
      handlers: {
        superseded: async () => {
          calls += 1
          return { ok: false, failureClass: 'SUPERSEDED', evidence: 'replaced by a newer push' }
        },
      },
    })

    await engine.tick()
    await engine.tick()
    await engine.tick()

    // Three pushes must not exhaust a task's three attempts: nothing was tried.
    expect(calls).toBe(3)
    expect(store.loadTasks().A?.attempts).toBe(0)
    expect(store.loadTasks().A?.status).not.toBe('BLOCKED')
    // And nothing was learned, so the stall clock is untouched.
    expect(store.loadRun()?.lastProgressAt).toBe(T0)
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

  it('prefers work it can do now over a wait it cannot shorten', () => {
    // Both blockers are real. Only one of them has an action attached, and a
    // programme that picks the wait has turned CI latency into its own latency.
    const next = nextStateForPullRequest({
      ...greenPr,
      requiredChecks: [{ name: 'ci', status: 'in_progress' }],
      reviews: [{ state: 'CHANGES_REQUESTED' }],
    })
    expect(next).toMatchObject({ status: 'ELIGIBLE', nextAction: 'ADDRESS_REVIEW' })
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

describe('external waiting must not become programme latency', () => {
  const clock = (from = T0) => {
    let tick = 0
    return () => new Date(Date.parse(from) + tick++ * 1000).toISOString()
  }

  it('releases the worker, runs independent work, and keeps dependants blocked', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'A', handler: 'push', order: 0 })
    store.upsertTask({ id: 'B', handler: 'work', order: 1 })
    store.upsertTask({ id: 'C', handler: 'work', order: 2, dependencies: ['A'] })

    const ran: string[] = []
    const engine = new LoopEngine({
      store,
      now: clock(),
      handlers: {
        push: async ({ task }: HandlerContext) => {
          ran.push(task.id)
          return { ok: true, status: 'WAITING_CI', nextAction: 'WATCH_CI', evidence: 'pushed' }
        },
        work: async ({ task }: HandlerContext) => {
          ran.push(task.id)
          return { ok: true, evidence: 'done' }
        },
      },
    })

    const decisions = await engine.run()

    // A parks on CI and is never dispatched again — no model polls it.
    expect(store.loadTasks().A?.status).toBe('WAITING_CI')
    expect(ran.filter((id) => id === 'A')).toHaveLength(1)
    // B runs anyway, with nobody saying continue.
    expect(ran).toContain('B')
    // C genuinely depends on A, so it stays put. Waiting is not completion.
    expect(store.loadTasks().C?.status).toBe('QUEUED')
    expect(ran).not.toContain('C')
    // And the programme reports the wait, not emptiness.
    expect(decisions.at(-1)?.outcome).toBe('WAITING_EXTERNAL')
  })

  it('does not count a healthy external wait as a stall', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'A', handler: 'push', order: 0 })
    store.transition('A', 'WAITING_CI', { at: T0, nextAction: 'WATCH_CI' })

    // Twenty and forty minutes on, with nothing else runnable. Before the
    // external/idle split this reported STALLED then BLOCKED, condemning a run
    // for correctly standing down during a thirty-minute CI cycle.
    let at = '2026-08-24T22:20:00.000Z'
    const engine = new LoopEngine({ store, now: () => at, handlers: {} })
    expect((await engine.tick()).outcome).toBe('WAITING_EXTERNAL')
    at = '2026-08-24T22:40:00.000Z'
    expect((await engine.tick()).outcome).toBe('WAITING_EXTERNAL')
    expect(store.loadRun()?.noProgressCycles).toBe(0)
    expect(store.loadTasks().A?.status).toBe('WAITING_CI')
  })

  it('still reports a true stall when nothing is awaited and nothing runs', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'A', handler: 'missing', order: 0 })
    store.transition('A', 'QUEUED', { at: T0 })

    // No handler, so nothing can advance and nothing is legitimately awaited.
    const engine = new LoopEngine({ store, now: () => '2026-08-24T22:20:00.000Z', handlers: {} })
    await engine.tick()
    const outcome = (await engine.tick()).outcome
    expect(['STALLED', 'BLOCKED', 'NO_HANDLER']).toContain(outcome)
  })

  it('resumes the parked task once external evidence makes it actionable', async () => {
    const store = new ControlPlaneStore(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'A', handler: 'work', order: 0 })
    store.upsertTask({ id: 'C', handler: 'work', order: 1, dependencies: ['A'] })
    store.transition('A', 'WAITING_CI', { at: T0, nextAction: 'WATCH_CI' })

    const ran: string[] = []
    const engine = new LoopEngine({
      store,
      now: clock(),
      handlers: {
        work: async ({ task }: HandlerContext) => {
          ran.push(task.id)
          return { ok: true, evidence: 'done' }
        },
      },
    })

    expect((await engine.tick()).outcome).toBe('WAITING_EXTERNAL')
    expect(ran).toEqual([])

    // A watcher observes CI going green and returns A to the queue. That is the
    // only thing that wakes it: the loop never decided to look again by itself.
    store.transition('A', 'ELIGIBLE', { at: T0, evidence: 'ci success observed', nextAction: 'MERGE' })
    await engine.run()

    expect(ran).toEqual(['A', 'C'])
    expect(store.loadTasks().C?.status).toBe('COMPLETED')
  })
})

describe('critical-path scheduling', () => {
  it('counts the work a task unblocks, transitively', () => {
    const tasks: Task[] = [
      { id: 'root', status: 'QUEUED' },
      { id: 'mid', status: 'QUEUED', dependencies: ['root'] },
      { id: 'leaf', status: 'QUEUED', dependencies: ['mid'] },
      { id: 'lonely', status: 'QUEUED' },
      { id: 'done', status: 'COMPLETED', dependencies: ['root'] },
    ]
    expect(countDownstream('root', tasks)).toBe(2)
    expect(countDownstream('mid', tasks)).toBe(1)
    expect(countDownstream('lonely', tasks)).toBe(0)
  })

  it('prefers the task that unblocks the most, over a lower declared order', () => {
    const tasks: Task[] = [
      { id: 'quick', status: 'QUEUED', order: 0 },
      { id: 'unblocker', status: 'QUEUED', order: 5 },
      { id: 'x', status: 'QUEUED', dependencies: ['unblocker'] },
      { id: 'y', status: 'QUEUED', dependencies: ['unblocker'] },
    ]
    expect(selectEligibleTask(freshRun(), tasks)?.id).toBe('unblocker')
  })

  it('lets an explicit priority outrank the downstream count', () => {
    const tasks: Task[] = [
      { id: 'urgent-repair', status: 'QUEUED', order: 9, priority: 10 },
      { id: 'unblocker', status: 'QUEUED', order: 0 },
      { id: 'x', status: 'QUEUED', dependencies: ['unblocker'] },
    ]
    expect(selectEligibleTask(freshRun(), tasks)?.id).toBe('urgent-repair')
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
