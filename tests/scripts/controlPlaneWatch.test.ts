import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ROUTE_OUTCOMES,
  applyVerdict,
  requiredMergeContexts,
  watchHandlers,
} from '../../scripts/control-plane/watch.mjs'
import { LoopEngine } from '../../scripts/control-plane/loop.mjs'
import { ControlPlaneStore } from '../../scripts/control-plane/state.mjs'

const REPOSITORY = 'nickygregal12-cmyk/Euro-2028-Predictor'
const HEAD = 'b3b9e319bac0edf55d0e487e282fa4c06233cf19'
const BASE = '175d290ae1bb724cdcea4afe231fc05a073175a6'
const T0 = '2026-08-26T02:30:00.000Z'
const REQUIRED = [
  'CI / Required merge gate',
  'Migration safety / Required migration gate',
  'Database parity / Required parity gate',
]

function parked(taskId = 'delivery.push') {
  const store = new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-watch-')))
  store.startRun({ hardStop: '2026-08-27T00:00:00.000Z', mode: 'ACTIVE', now: T0 })
  store.upsertTask({ id: taskId, order: 1, handler: 'delivery.push', mutating: true })
  store.transition(taskId, 'WAITING_CI', { at: T0, evidence: 'pushed; awaiting required checks' })
  return store
}

/** A GitHub that answers with whatever conclusions the test asks for. */
function github({
  conclusions = REQUIRED.map(() => 'success'),
  status = 'completed',
  headSha = HEAD,
  reviews = [] as unknown[],
  mergeable = true,
} = {}) {
  const runs = REQUIRED.map((name, index) => ({
    name,
    status,
    conclusion: status === 'completed' ? conclusions[index] : null,
    head_sha: headSha,
    started_at: '2026-08-26T02:20:00Z',
  }))
  const bodies: Record<string, unknown> = {
    [`repos/${REPOSITORY}/pulls/1060`]: {
      number: 1060, state: 'open', draft: false, merged: false, mergeable,
      head: { sha: headSha }, base: { sha: BASE },
    },
    [`repos/${REPOSITORY}/commits/${headSha}/check-runs?per_page=100`]: { check_runs: runs },
    [`repos/${REPOSITORY}/commits/${headSha}/status`]: { statuses: [] },
    [`repos/${REPOSITORY}/pulls/1060/reviews?per_page=100`]: reviews,
    [`repos/${REPOSITORY}/commits/${headSha}/check-runs?per_page=100&filter=all`]: { check_runs: runs },
    [`repos/${REPOSITORY}/commits/${BASE}/check-runs?per_page=100&filter=all`]: { check_runs: [] },
  }
  return async (path: string) => {
    if (!(path in bodies)) throw new Error(`GET ${path} answered 404`)
    return bodies[path]
  }
}

function watchTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ci.watch', handler: 'ci.watch', order: 2,
    pullNumber: 1060, watches: 'delivery.push', expectedHeadSha: HEAD, baseSha: BASE,
    ...overrides,
  }
}

describe('the watcher ends the wait that nothing could end', () => {
  it('releases the parked task when every required check passed on this head', async () => {
    const store = parked()
    const handlers = watchHandlers({ read: github(), repository: REPOSITORY, requiredCheckNames: REQUIRED })

    const result = await handlers['ci.watch']({ task: watchTask(), store, at: T0 })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('COMPLETED')
    expect(store.loadTasks()['delivery.push']?.status).toBe('COMPLETED')
    expect(store.loadTasks()['delivery.push']?.nextAction).toContain('not this authority to give')
  })

  it('leaves it parked while a required check is still running', async () => {
    const store = parked()
    const handlers = watchHandlers({
      read: github({ status: 'in_progress' }), repository: REPOSITORY, requiredCheckNames: REQUIRED,
    })

    const result = await handlers['ci.watch']({ task: watchTask(), store, at: T0 })

    expect(result.status).toBe('WAITING_CI')
    expect(result.nextAction).toBe('observe this head again')
    expect(store.loadTasks()['delivery.push']?.status).toBe('WAITING_CI')
  })

  it('waits while the aggregate has not started, rather than calling the branch broken', async () => {
    // The live shape, measured against #1060 two minutes after the push: `ci`
    // is in progress and the aggregate it feeds has NO RUN AT ALL, so every
    // required context reads as missing. Before this was fixed the watcher
    // handed a perfectly healthy branch to the owner as needing repair.
    const bodies: Record<string, unknown> = {
      [`repos/${REPOSITORY}/pulls/1060`]: {
        number: 1060, state: 'open', mergeable: true,
        head: { sha: HEAD }, base: { sha: BASE },
      },
      [`repos/${REPOSITORY}/commits/${HEAD}/check-runs?per_page=100`]: {
        check_runs: [{ name: 'ci', status: 'in_progress', conclusion: null, head_sha: HEAD }],
      },
      [`repos/${REPOSITORY}/commits/${HEAD}/status`]: { statuses: [] },
      [`repos/${REPOSITORY}/pulls/1060/reviews?per_page=100`]: [],
      [`repos/${REPOSITORY}/commits/${HEAD}/check-runs?per_page=100&filter=all`]: {
        check_runs: [{ name: 'ci', status: 'in_progress', conclusion: null, head_sha: HEAD }],
      },
      [`repos/${REPOSITORY}/commits/${BASE}/check-runs?per_page=100&filter=all`]: { check_runs: [] },
    }
    const store = parked()
    const handlers = watchHandlers({
      read: async (path: string) => {
        if (!(path in bodies)) throw new Error(`GET ${path} answered 404`)
        return bodies[path]
      },
      repository: REPOSITORY,
      requiredCheckNames: REQUIRED,
    })

    const result = await handlers['ci.watch']({ task: watchTask(), store, at: T0 })

    expect(result.checkpoint?.route).toBe('WATCH_CI')
    expect(result.status).toBe('WAITING_CI')
    expect(store.loadTasks()['delivery.push']?.status).toBe('WAITING_CI')
  })

  it('hands a red branch to the owner with the route named, rather than re-queueing a push', async () => {
    const store = parked()
    const handlers = watchHandlers({
      read: github({ conclusions: ['failure', 'success', 'success'] }),
      repository: REPOSITORY, requiredCheckNames: REQUIRED,
    })

    const result = await handlers['ci.watch']({ task: watchTask(), store, at: T0 })

    const task = store.loadTasks()['delivery.push']
    expect(task?.status).toBe('WAITING_OWNER')
    expect(task?.blocker).toBe('REPAIR_CI')
    // Re-queueing would re-run the push, which was never what was wrong.
    expect(result.status).toBe('COMPLETED')
  })

  it('refuses to act on a verdict about a different commit', async () => {
    const store = parked()
    const handlers = watchHandlers({
      read: github({ headSha: '0000000000000000000000000000000000000000' }),
      repository: REPOSITORY, requiredCheckNames: REQUIRED,
    })

    const result = await handlers['ci.watch']({ task: watchTask(), store, at: T0 })

    // A push during the wait moves the head. Applying the old verdict to the
    // new commit is the fail-open decideCanaryMerge exists to prevent.
    expect(result.status).toBe('WAITING_CI')
    expect(result.evidence).toContain('head moved')
    expect(store.loadTasks()['delivery.push']?.status).toBe('WAITING_CI')
  })

  it('refuses a watch that does not say what it is watching', async () => {
    const store = parked()
    const handlers = watchHandlers({ read: github(), repository: REPOSITORY, requiredCheckNames: REQUIRED })

    for (const overrides of [{ watches: undefined }, { expectedHeadSha: undefined }]) {
      const result = await handlers['ci.watch']({ task: watchTask(overrides), store, at: T0 })
      expect(result.ok, JSON.stringify(overrides)).toBe(false)
      expect(result.blocker).toBe('UNCONFIGURED_WATCH')
    }
    expect(store.loadTasks()['delivery.push']?.status).toBe('WAITING_CI')
  })

  it('classifies a failure to reach GitHub rather than reporting a verdict', async () => {
    const store = parked()
    const handlers = watchHandlers({
      read: async () => { throw new Error('GET answered 503') },
      repository: REPOSITORY, requiredCheckNames: REQUIRED,
    })

    const result = await handlers['ci.watch']({ task: watchTask(), store, at: T0 })

    expect(result.ok).toBe(false)
    expect(result.failureClass).toBe('PROVIDER_OUTAGE')
    expect(store.loadTasks()['delivery.push']?.status).toBe('WAITING_CI')
  })
})

describe('routes map onto task state, and an unknown one is not a pass', () => {
  it('keeps waiting only for WATCH_CI', () => {
    const waiting = Object.entries(ROUTE_OUTCOMES).filter(([, outcome]) => !outcome.resolved)
    expect(waiting.map(([route]) => route)).toEqual(['WATCH_CI'])
  })

  it('refuses to act on a route it does not recognise', () => {
    const store = parked()

    const verdict = applyVerdict({
      store, at: T0, watchedTaskId: 'delivery.push', expectedHeadSha: HEAD,
      triage: { headSha: HEAD, nextAction: 'SHIP_IT', blockers: [] },
    })

    // A route added in policy.mjs and not mapped here means the two files have
    // drifted. That must read as "do not act", never as "carry on".
    expect(verdict.resolved).toBe(false)
    expect(verdict.evidence).toContain('unrecognised route')
    expect(store.loadTasks()['delivery.push']?.status).toBe('WAITING_CI')
  })
})

describe('the loop uses it end to end', () => {
  it('parks, observes, releases — with nothing telling it to continue', async () => {
    const store = parked()
    let greenYet = false
    const handlers = {
      ...watchHandlers({
        read: async (path: string) => github({ status: greenYet ? 'completed' : 'in_progress' })(path),
        repository: REPOSITORY,
        requiredCheckNames: REQUIRED,
      }),
      'delivery.push': async () => ({ ok: true, status: 'WAITING_CI', evidence: 'pushed' }),
    }
    store.upsertTask(watchTask())
    const engine = new LoopEngine({ store, handlers: handlers as never, now: () => T0 })

    await engine.run({ maxTicks: 5 })
    expect(store.loadTasks()['delivery.push']?.status).toBe('WAITING_CI')
    expect(store.loadTasks()['ci.watch']?.status).toBe('WAITING_CI')

    // CI finishes. Nothing else changes; the next pass is the whole mechanism.
    greenYet = true
    store.transition('ci.watch', 'QUEUED', { at: T0, evidence: 'watcher woken' })
    await engine.run({ maxTicks: 5 })

    expect(store.loadTasks()['delivery.push']?.status).toBe('COMPLETED')
    expect(store.loadTasks()['ci.watch']?.status).toBe('COMPLETED')
  })
})

describe('the required set comes from the tracked record of the live ruleset', () => {
  it('reads it rather than keeping a copy', () => {
    // config/required-merge-contexts.json exists because a required-check set is
    // hosted state a clone cannot see, and the run that produced it found two
    // places in this repository asserting a context was required when it was
    // not. A copy here would be a third chance to be wrong about the same thing.
    expect(requiredMergeContexts().slice().sort()).toEqual(REQUIRED.slice().sort())
  })

  it('is what the handler uses when the caller does not say', async () => {
    const store = parked()
    const handlers = watchHandlers({ read: github(), repository: REPOSITORY })

    const result = await handlers['ci.watch']({ task: watchTask(), store, at: T0 })

    expect(result.status).toBe('COMPLETED')
    expect(store.loadTasks()['delivery.push']?.status).toBe('COMPLETED')
  })
})
