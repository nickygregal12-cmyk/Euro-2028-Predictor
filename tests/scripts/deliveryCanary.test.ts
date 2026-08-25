import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ENFORCEMENT_SURFACE,
  POLICY_REFUSED,
  decideCanaryMerge,
  deliveryHandlers,
  modifiedEnforcementFiles,
  permitted,
} from '../../scripts/control-plane/delivery.mjs'
import { LoopEngine } from '../../scripts/control-plane/loop.mjs'
import { ControlPlaneStore } from '../../scripts/control-plane/state.mjs'

const BRANCH = 'claude/delivery-canary'
const REQUIRED = [
  'CI / Required merge gate',
  'Migration safety / Required migration gate',
  'Database parity / Required parity gate',
]

/** A store in its own directory, so nothing here touches real control state. */
function freshStore() {
  return new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-canary-')))
}

function programme(handlers: Record<string, unknown>) {
  const store = freshStore()
  let clock = Date.parse('2026-08-25T20:00:00.000Z')
  const now = () => new Date((clock += 1000)).toISOString()
  store.startRun({ hardStop: '2026-08-26T00:00:00.000Z', mode: 'ACTIVE', now: now() })

  store.upsertTask({ id: 'branch', handler: 'delivery.branch', mutating: true, order: 1 })
  store.upsertTask({ id: 'commit', handler: 'delivery.commit', mutating: true, order: 2, dependencies: ['branch'] })
  store.upsertTask({ id: 'push', handler: 'delivery.push', mutating: true, order: 3, dependencies: ['commit'] })
  store.upsertTask({ id: 'merge', handler: 'delivery.merge', mutating: true, order: 4, dependencies: ['push'] })
  // Independent of the whole chain: the thing that must keep moving while the
  // push is parked on CI.
  store.upsertTask({ id: 'independent', handler: 'noop', mutating: false, order: 9 })

  return { store, now, engine: new LoopEngine({ store, handlers: handlers as never, now }) }
}

describe('the delivery canary drives the loop, not the other way round', () => {
  it('sequences branch, commit and push with no instruction to continue', async () => {
    const calls: string[][] = []
    const handlers = {
      ...deliveryHandlers({ branch: BRANCH, title: 'canary', runCommand: (argv) => { if (argv[0] === 'git') return ''; calls.push(argv); return '' } }),
      noop: async () => ({ ok: true, evidence: 'independent work' }),
    }
    const { engine, store } = programme(handlers)

    for (let tick = 0; tick < 6; tick += 1) await engine.tick()

    expect(calls.map((argv) => argv[1]?.split('/').pop())).toEqual([
      'owner-branch.sh', 'owner-commit.sh', 'owner-task-push.sh',
    ])
    const byId = store.loadTasks()
    expect(byId.branch?.status).toBe('COMPLETED')
    expect(byId.commit?.status).toBe('COMPLETED')
  })

  it('parks the push on CI, releases the worker, and keeps the dependant blocked', async () => {
    const handlers = {
      ...deliveryHandlers({ branch: BRANCH, title: 'canary', runCommand: () => '' }),
      'delivery.merge': async () => ({ ok: true, evidence: 'merged' }),
      noop: async () => ({ ok: true, evidence: 'independent work' }),
    }
    const { engine, store } = programme(handlers)
    for (let tick = 0; tick < 6; tick += 1) await engine.tick()

    const byId = store.loadTasks()
    // The push is parked on external state, not finished.
    expect(byId.push?.status).toBe('WAITING_CI')
    // Waiting is not completion, so what depends on it has not run.
    expect(byId.merge?.status).not.toBe('COMPLETED')
    // ...and independent work went ahead anyway rather than queueing behind CI.
    expect(byId.independent?.status).toBe('COMPLETED')

    const checkpoint = store.getCheckpoint('push')
    expect(checkpoint).toMatchObject({ branch: BRANCH, completed: 'branch pushed', awaiting: 'required checks' })

    // Nothing is dispatched again while it waits: the worker is gone.
    const after = await engine.tick()
    expect(['IDLE', 'WAITING_EXTERNAL', 'ALL_COMPLETE']).toContain(after.outcome)
    expect(after.dispatched).toBeNull()
  })

  it('refuses to act at all when the policy refuses, and says which operation', async () => {
    const calls: string[][] = []
    const handlers = deliveryHandlers({
      branch: 'main', // not a task branch
      title: 'canary',
      runCommand: (argv) => { if (argv[0] === 'git') return ''; calls.push(argv); return '' },
    })
    for (const [operation, handler] of Object.entries(handlers)) {
      const result = await handler({ at: '2026-08-25T20:00:00.000Z', task: {} } as never)
      expect(result.ok, operation).toBe(false)
      expect(result.failureClass, operation).toBe('POLICY_DENIAL')
    }
    // The refusal happened before anything ran.
    expect(calls).toEqual([])
  })

  it('asks the policy for the operation it is about to perform', () => {
    expect(permitted('branch.push', BRANCH)).toMatchObject({ allowed: true })
    expect(permitted('branch.push', 'main')).toMatchObject({ allowed: false })
    expect(permitted('pr.merge', BRANCH)).toMatchObject({ allowed: false })
  })
})

describe('the gate cannot vouch for a change to itself', () => {
  it('names every file whose modification would make enforcement advisory', () => {
    for (const path of [
      'scripts/agent-tools/owner-task-push.sh', 'scripts/agent-tools/owner-pr.sh',
      'scripts/agent-tools/owner-commit.sh', 'scripts/agent-tools/owner-branch.sh',
      'scripts/control-plane/authority.mjs', 'scripts/control-plane/identity.mjs',
      'scripts/control-plane/delivery.mjs',
      'config/pre-live-owner-authority.json', 'config/control-plane-identity.json',
    ]) {
      expect(ENFORCEMENT_SURFACE, path).toContain(path)
    }
  })

  it('refuses every mutating step when the delivery changes the gate', async () => {
    // Review's point: the handlers run the wrapper from the same tree being
    // delivered, so a candidate that edits owner-task-push.sh would be gated by
    // its own edit. Such a change goes through review, not through automation.
    const calls: string[][] = []
    const handlers = deliveryHandlers({
      branch: BRANCH,
      title: 'canary',
      runCommand: (argv) => {
        if (argv[0] === 'git') return 'scripts/agent-tools/owner-task-push.sh\n'
        calls.push(argv)
        return ''
      },
    })
    for (const [operation, handler] of Object.entries(handlers)) {
      const result = await handler({ at: '2026-08-25T20:00:00.000Z', task: {} } as never)
      expect(result.ok, operation).toBe(false)
      expect(result.failureClass, operation).toBe('POLICY_DENIAL')
      expect(result.blocker, operation).toBe('ENFORCEMENT_MODIFIED')
      expect(result.evidence, operation).toContain('owner-task-push.sh')
    }
    expect(calls, 'nothing ran').toEqual([])
  })

  it('reads the comparison against the last reviewed state, not the candidate', () => {
    const argv: string[][] = []
    modifiedEnforcementFiles((a) => { argv.push(a); return '' })
    expect(argv[0]?.slice(0, 4)).toEqual(['git', 'diff', '--name-only', 'origin/main'])
  })

  it('classifies a wrapper authority refusal as POLICY_DENIAL, not a defect', async () => {
    // A denial is not a defect. Collapsing it into CODE made the loop retry a
    // decision that will never change.
    const handlers = deliveryHandlers({
      branch: BRANCH,
      title: 'canary',
      runCommand: (argv) => {
        if (argv[0] === 'git') return ''
        const error: Error & { status?: number } = new Error('Refusing: not permitted by policy')
        error.status = POLICY_REFUSED
        throw error
      },
    })
    const result = await handlers['delivery.push']({ at: '2026-08-25T20:00:00.000Z' } as never)
    expect(result.failureClass).toBe('POLICY_DENIAL')
  })

  it('sends every other failure through the shared classifier', async () => {
    const handlers = deliveryHandlers({
      branch: BRANCH,
      title: 'canary',
      runCommand: (argv) => {
        if (argv[0] === 'git') return ''
        const error: Error & { status?: number } = new Error('command not found')
        error.status = 127
        throw error
      },
    })
    const result = await handlers['delivery.push']({ at: '2026-08-25T20:00:00.000Z' } as never)
    expect(result.failureClass).toBe('UNKNOWN')
  })

  it('reads an unrecoverable 403 as AUTH_REQUIRED rather than a defect to retry', async () => {
    // Measured in the first live canary run: `gh pr create` answered
    // `HTTP 403 ... not enabled for this session`, and a hardcoded failure class
    // made the loop spend all three attempts on it in under a second.
    const handlers = deliveryHandlers({
      branch: BRANCH,
      title: 'canary',
      runCommand: (argv) => {
        if (argv[0] === 'git') return ''
        const error: Error & { status?: number } = new Error(
          'Command failed: HTTP 403: This GraphQL query is not enabled for this session',
        )
        error.status = 1
        throw error
      },
    })
    const result = await handlers['delivery.pr']({ at: '2026-08-25T20:00:00.000Z' } as never)
    expect(result.failureClass).toBe('AUTH_REQUIRED')
  })
})

describe('merge eligibility is computed from observed state', () => {
  const head = 'e3cf95c'
  // Green *for this head*. A fixture without provenance is no longer evidence.
  const green = REQUIRED.map((name) => ({ name, status: 'completed', conclusion: 'success', head_sha: head }))
  const base = 'c0747d6'
  // A pull request that is eligible in every other respect. If a fixture were
  // short of this, a test would pass on the missing field rather than on the
  // condition it names — which is how the rewrite test came to prove nothing.
  const eligible = (over: Record<string, unknown> = {}) => ({
    number: 1, state: 'open', draft: false, merged: false,
    headSha: head, baseSha: base, mergeable: true,
    checkRuns: green, reviewThreads: [], reviews: [], ...over,
  })

  it('allows the merge only when every required check passed on this head', () => {
    expect(decideCanaryMerge({
      observed: eligible(),
      requiredCheckNames: REQUIRED, baseSha: base, expectedHeadSha: head,
    })).toMatchObject({ allowed: true })
  })

  it('refuses a required check that never reported, rather than reading absence as pass', () => {
    const verdict = decideCanaryMerge({
      observed: eligible({ checkRuns: green.slice(1) }),
      requiredCheckNames: REQUIRED, baseSha: base, expectedHeadSha: head,
    })
    expect(verdict.allowed).toBe(false)
  })

  it('refuses when the head moved after the evidence was gathered', () => {
    const verdict = decideCanaryMerge({
      observed: eligible(),
      requiredCheckNames: REQUIRED, baseSha: base, expectedHeadSha: 'a-newer-commit',
    })
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toContain('head')
  })

  it('refuses green evidence that belongs to an earlier commit', () => {
    // Measured before the fix: three required checks all green on an older
    // commit, head NEWHEAD, merge allowed with no blockers at all.
    const verdict = decideCanaryMerge({
      observed: eligible({
        checkRuns: REQUIRED.map((name) => ({ name, status: 'completed', conclusion: 'success', head_sha: '0000old' })),
      }),
      requiredCheckNames: REQUIRED, baseSha: base, expectedHeadSha: head,
    })
    expect(verdict.allowed).toBe(false)
    expect(verdict.reason).toContain('evidence_not_for_head')
  })

  it('refuses a required check whose provenance cannot be read', () => {
    const verdict = decideCanaryMerge({
      observed: eligible({ checkRuns: REQUIRED.map((name) => ({ name, status: 'completed', conclusion: 'success' })) }),
      requiredCheckNames: REQUIRED, baseSha: base, expectedHeadSha: head,
    })
    expect(verdict.allowed).toBe(false)
  })

  it('refuses a cancelled or skipped required check', () => {
    for (const conclusion of ['cancelled', 'skipped', 'failure', 'timed_out']) {
      const verdict = decideCanaryMerge({
        observed: eligible({ checkRuns: [{ name: REQUIRED[0], status: 'completed', conclusion }, ...green.slice(1)] }),
        requiredCheckNames: REQUIRED, baseSha: base, expectedHeadSha: head,
      })
      expect(verdict.allowed, conclusion).toBe(false)
    }
  })
})
