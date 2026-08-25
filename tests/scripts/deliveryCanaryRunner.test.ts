import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  PUSH_TASK,
  canaryHandlers,
  canaryTasks,
} from '../../scripts/control-plane/canary.mjs'
import { ENFORCEMENT_SURFACE } from '../../scripts/control-plane/delivery.mjs'
import { LoopEngine } from '../../scripts/control-plane/loop.mjs'
import { ControlPlaneStore } from '../../scripts/control-plane/state.mjs'

const BRANCH = 'claude/delivery-canary'

/**
 * A `runCommand` that answers the two questions the handlers ask git, records
 * every wrapper invocation, and never touches a real repository.
 */
function recorder({ staged = ['docs/ops/note.md'], enforcementDirty = [] as string[] } = {}) {
  const calls: string[][] = []
  const runCommand = (argv: string[]) => {
    calls.push(argv)
    if (argv[0] === 'git' && argv[1] === 'diff' && argv[2] === '--cached') {
      return staged.join('\n')
    }
    if (argv[0] === 'git' && argv[1] === 'diff' && argv[3] === 'origin/main') {
      return enforcementDirty.join('\n')
    }
    return ''
  }
  const wrappers = () =>
    calls
      .filter((argv) => argv[0] === 'bash')
      .map((argv) => String(argv[1]).split('/').pop() ?? '')
  return { calls, runCommand, wrappers }
}

function programme(handlers: Record<string, unknown>, tasks = canaryTasks()) {
  const store = new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-canary-run-')))
  let clock = Date.parse('2026-08-25T21:00:00.000Z')
  const now = () => new Date((clock += 1000)).toISOString()
  store.startRun({ hardStop: '2026-08-26T06:00:00.000Z', mode: 'ACTIVE', now: now(), maxPullRequests: 1 })
  for (const task of tasks) store.upsertTask(task)
  return { store, engine: new LoopEngine({ store, handlers: handlers as never, now }) }
}

describe('the canary runner starts the loop and then stops being involved', () => {
  it('runs the whole delivery from one start, parks on CI, and never reaches the merge', async () => {
    const { runCommand, wrappers } = recorder()
    const handlers = {
      ...canaryHandlers({ branch: BRANCH, title: 'canary', body: 'body', runCommand }),
      'tests.focused': async () => ({ ok: true, evidence: 'independent work ran' }),
    }
    const { engine, store } = programme(handlers, canaryTasks({ independentCommand: ['true'] }))

    const decisions = await engine.run({ maxTicks: 12 })
    const byId = store.loadTasks()
    const status = (id: string) => byId[id]?.status ?? 'QUEUED'

    // Every wrapper, in order, chosen by the scheduler rather than by a caller.
    expect(wrappers()).toEqual([
      'owner-branch.sh', 'owner-commit.sh', 'owner-task-push.sh', 'owner-pr.sh',
    ])

    // The push parked. Waiting is not completion.
    expect(status(PUSH_TASK)).toBe('WAITING_CI')
    expect(status('canary.pr')).toBe('WAITING_CI')

    // Independent work went ahead anyway — the point of releasing the worker.
    expect(status('independent.evidence')).toBe('COMPLETED')

    // The dependant of the parked push was never dispatched. A missing handler
    // would have been reported as NO_HANDLER, so QUEUED proves it never ran.
    expect(status('delivery.merge')).toBe('QUEUED')
    expect(decisions.some((d) => d.dispatched === 'delivery.merge')).toBe(false)

    // Parked, not finished and not idle.
    expect(decisions.at(-1)?.outcome).toBe('WAITING_EXTERNAL')
  })

  it('refuses to stage the enforcement surface', async () => {
    const { runCommand, wrappers } = recorder({ staged: [String(ENFORCEMENT_SURFACE[0]), 'docs/ops/note.md'] })
    const handlers = canaryHandlers({ branch: BRANCH, title: 'canary', body: '', runCommand })

    const result = await handlers['canary.stage']({ at: '2026-08-25T21:00:00.000Z' })

    expect(result.ok).toBe(false)
    expect(result.blocker).toBe('ENFORCEMENT_MODIFIED')
    expect(result.failureClass).toBe('POLICY_DENIAL')
    expect(wrappers()).toEqual([])
  })

  it('refuses an empty index rather than committing nothing', async () => {
    const { runCommand } = recorder({ staged: [] })
    const handlers = canaryHandlers({ branch: BRANCH, title: 'canary', body: '', runCommand })

    const result = await handlers['canary.stage']({ at: '2026-08-25T21:00:00.000Z' })

    expect(result.ok).toBe(false)
    expect(result.blocker).toBe('NOTHING_STAGED')
  })

  it('will not open a pull request for a head that was never pushed', async () => {
    const { runCommand, wrappers } = recorder()
    const handlers = canaryHandlers({ branch: BRANCH, title: 'canary', body: '', runCommand })
    const store = new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-canary-pr-')))

    const result = await handlers['canary.pr']({ at: '2026-08-25T21:00:00.000Z', store })

    expect(result.ok).toBe(false)
    expect(result.blocker).toBe('PUSH_NOT_CHECKPOINTED')
    expect(wrappers()).toEqual([])
  })

  it('will not open a pull request from another branch checkpoint', async () => {
    const { runCommand, wrappers } = recorder()
    const handlers = canaryHandlers({ branch: BRANCH, title: 'canary', body: '', runCommand })
    const store = new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-canary-pr2-')))
    store.saveCheckpoint(PUSH_TASK, {
      at: '2026-08-25T21:00:00.000Z', branch: 'claude/somewhere-else', completed: 'branch pushed',
    })

    const result = await handlers['canary.pr']({ at: '2026-08-25T21:00:01.000Z', store })

    expect(result.ok).toBe(false)
    expect(result.blocker).toBe('CHECKPOINT_BRANCH_MISMATCH')
    expect(wrappers()).toEqual([])
  })

  it('opens the pull request once the push has checkpointed for this branch', async () => {
    const { runCommand, wrappers } = recorder()
    const handlers = canaryHandlers({ branch: BRANCH, title: 'canary', body: '', runCommand })
    const store = new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-canary-pr3-')))
    store.saveCheckpoint(PUSH_TASK, {
      at: '2026-08-25T21:00:00.000Z', branch: BRANCH, completed: 'branch pushed',
    })

    const result = await handlers['canary.pr']({ at: '2026-08-25T21:00:01.000Z', store })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('WAITING_CI')
    expect(wrappers()).toEqual(['owner-pr.sh'])
  })

  it('commits the message it was given, not the pull request title', async () => {
    const { runCommand, calls } = recorder()
    const handlers = {
      ...canaryHandlers({ branch: BRANCH, title: 'a one-line title', body: '', runCommand }),
      'tests.focused': async () => ({ ok: true, evidence: '' }),
    }
    const message = 'A subject line\n\nAnd the paragraph that explains it.'
    const { engine } = programme(handlers, canaryTasks({ commitMessage: message }))

    await engine.run({ maxTicks: 12 })

    const commit = calls.find((argv) => String(argv[1]).endsWith('owner-commit.sh'))
    expect(commit?.slice(2)).toEqual(['--message', message])
  })

  it('gives the merge task no handler, so reaching it could never merge silently', () => {
    const merge = canaryTasks().find((task) => task.id === 'delivery.merge')
    const handlers = canaryHandlers({ branch: BRANCH, title: '', body: '', runCommand: () => '' })

    expect(merge?.dependencies).toEqual([PUSH_TASK])
    expect(Object.keys(handlers)).not.toContain('delivery.merge')
  })
})
