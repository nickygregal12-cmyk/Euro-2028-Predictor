import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { decideCanaryMerge, deliveryHandlers, permitted } from '../../scripts/control-plane/delivery.mjs'
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
      ...deliveryHandlers({ branch: BRANCH, title: 'canary', runCommand: (argv) => { calls.push(argv); return '' } }),
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
      runCommand: (argv) => { calls.push(argv); return '' },
    })
    for (const [operation, handler] of Object.entries(handlers)) {
      const result = await handler({ at: '2026-08-25T20:00:00.000Z', task: {} } as never)
      expect(result.ok, operation).toBe(false)
      expect(result.failureClass, operation).toBe('POLICY')
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

describe('merge eligibility is computed from observed state', () => {
  const green = REQUIRED.map((name) => ({ name, status: 'completed', conclusion: 'success' }))
  const base = 'c0747d6'
  const head = 'e3cf95c'
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
