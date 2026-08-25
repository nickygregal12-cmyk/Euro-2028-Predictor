import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  ControlPlaneLedger,
  importFromFiles,
  openControlPlaneState,
} from '../../scripts/control-plane/ledger.mjs'
import { ControlPlaneStore } from '../../scripts/control-plane/state.mjs'

const HARD_STOP = '2026-08-26T06:00:00.000Z'
const T0 = '2026-08-25T22:00:00.000Z'

const open: Array<{ close?: () => void }> = []
afterEach(() => {
  for (const handle of open.splice(0)) handle.close?.()
})

function freshDir() {
  return mkdtempSync(resolve(tmpdir(), 'predictor-ledger-'))
}

function ledgerIn(dir: string) {
  const ledger = new ControlPlaneLedger(resolve(dir, 'control-plane.sqlite'))
  open.push(ledger)
  return ledger
}

/**
 * "Drop-in" is a claim about behaviour, so it is measured rather than asserted:
 * one suite, both implementations, same expectations.
 */
const IMPLEMENTATIONS: Array<[string, (dir: string) => any]> = [
  ['ControlPlaneStore (files)', (dir) => new ControlPlaneStore(dir)],
  ['ControlPlaneLedger (sqlite)', (dir) => ledgerIn(dir)],
]

describe.each(IMPLEMENTATIONS)('%s', (_name, make) => {
  it('starts a run once and returns the same one on restart', () => {
    const dir = freshDir()
    const first = make(dir).startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    // A second process, not a second call on the same object.
    const second = make(dir).startRun({ hardStop: HARD_STOP, mode: 'OBSERVE_ONLY', now: 'later' })

    expect(second.runId).toBe(first.runId)
    expect(second.mode).toBe('ACTIVE')
  })

  it('refuses a run mode and a hard stop it cannot use', () => {
    const store = make(freshDir())
    expect(() => store.startRun({ hardStop: HARD_STOP, mode: 'YOLO', now: T0 })).toThrow(/run mode/)
    expect(() => store.startRun({ hardStop: 'whenever', now: T0 })).toThrow(/parseable timestamp/)
    // NaN makes every comparison false, so an unusable hard stop would disable
    // the brake rather than announce itself.
    expect(() => store.startRun({ hardStop: undefined, now: T0 })).toThrow(/parseable timestamp/)
  })

  it('orders tasks by order then id, and merges an upsert over what exists', () => {
    const store = make(freshDir())
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'b', order: 2, handler: 'h' })
    store.upsertTask({ id: 'a', order: 1, handler: 'h' })
    store.upsertTask({ id: 'c', order: 1, handler: 'h' })
    store.upsertTask({ id: 'a', objective: 'added later' })

    expect(store.listTasks().map((task: any) => task.id)).toEqual(['a', 'c', 'b'])
    expect(store.loadTasks().a).toMatchObject({ handler: 'h', objective: 'added later', status: 'QUEUED', attempts: 0 })
  })

  it('refuses an unknown task state and a task with no id', () => {
    const store = make(freshDir())
    expect(() => store.upsertTask({ id: 'x', status: 'NEARLY' })).toThrow(/task state/)
    expect(() => store.upsertTask({ order: 1 })).toThrow(/id/)
  })

  it('records a transition, its event, and the from-state it left', () => {
    const dir = freshDir()
    const store = make(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'a', order: 1, handler: 'h' })
    store.transition('a', 'WAITING_CI', { at: T0, evidence: 'pushed', nextAction: 'a watcher' })

    // `evidence` lives in the event log, not on the task: the row is current
    // state, the log is history, and the same fact in two places can disagree.
    expect(make(dir).loadTasks().a).toMatchObject({ status: 'WAITING_CI', nextAction: 'a watcher' })
    expect(make(dir).loadTasks().a).not.toHaveProperty('evidence')
    expect(store.readEvents().at(-1)).toMatchObject({
      kind: 'TASK_TRANSITION', task: 'a', from: 'QUEUED', to: 'WAITING_CI',
    })
    expect(() => store.transition('missing', 'COMPLETED', { at: T0 })).toThrow(/unknown task/)
  })

  it('counts attempts, and only counts a repeat when the class repeats', () => {
    const store = make(freshDir())
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'a', order: 1, handler: 'h' })

    expect(store.recordAttempt('a', { at: T0, failureClass: 'AUTH_REQUIRED' }).attempts).toBe(1)
    const repeated = store.recordAttempt('a', { at: T0, failureClass: 'AUTH_REQUIRED' })
    expect(repeated).toMatchObject({ attempts: 2, repeatedFailures: 1 })
    // A different class is a different problem, so the repeat counter restarts.
    expect(store.recordAttempt('a', { at: T0, failureClass: 'PROVIDER_LIMIT' })).toMatchObject({
      attempts: 3, repeatedFailures: 0,
    })
  })

  it('keeps a checkpoint readable by whoever picks the run back up', () => {
    const dir = freshDir()
    const store = make(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'a', order: 1, handler: 'h' })
    store.saveCheckpoint('a', { at: T0, sha: 'abc1234', completed: 'branch pushed' })

    expect(make(dir).getCheckpoint('a')).toMatchObject({ taskId: 'a', sha: 'abc1234', completed: 'branch pushed' })
    expect(store.getCheckpoint('nothing')).toBe(null)
    expect(store.readEvents().at(-1)).toMatchObject({ kind: 'CHECKPOINT', task: 'a', sha: 'abc1234' })
  })

  it('reads events back in the order they happened, and none before there are any', () => {
    const dir = freshDir()
    expect(make(dir).readEvents()).toEqual([])
    const store = make(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.appendEvent({ at: T0, kind: 'ONE' })
    store.appendEvent({ at: T0, kind: 'TWO' })

    expect(make(dir).readEvents().map((event: any) => event.kind)).toEqual(['RUN_STARTED', 'ONE', 'TWO'])
  })

  it('holds the writer lane against another holder, and frees it by expiry', () => {
    const dir = freshDir()
    const store = make(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })

    expect(store.acquireLease('worker-a', { at: T0, ttlMs: 60_000 }).acquired).toBe(true)
    expect(make(dir).acquireLease('worker-b', { at: T0, ttlMs: 60_000 })).toMatchObject({
      acquired: false, heldBy: 'worker-a',
    })
    // A crashed holder frees the lane by time rather than needing a human.
    expect(make(dir).acquireLease('worker-b', { at: '2026-08-25T23:00:00.000Z' }).acquired).toBe(true)
    expect(store.releaseLease('worker-a', T0)).toBe(false)
  })

  it('refuses to persist anything shaped like a credential', () => {
    const store = make(freshDir())
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    for (const event of [
      { at: T0, kind: 'X', token: 'ghp_x' },
      { at: T0, kind: 'X', nested: { api_key: 'x' } },
      { at: T0, kind: 'X', authorization: 'Bearer x' },
    ]) {
      expect(() => store.appendEvent(event), JSON.stringify(event)).toThrow(/secret-shaped/)
    }
  })

  it('records progress against the run, and nothing when there is no run', () => {
    const dir = freshDir()
    expect(make(dir).recordProgress(T0)).toBe(null)
    const store = make(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.saveRun({ ...store.loadRun(), noProgressCycles: 2 })

    expect(store.recordProgress('2026-08-25T23:00:00.000Z')).toMatchObject({
      lastProgressAt: '2026-08-25T23:00:00.000Z', noProgressCycles: 0,
    })
  })

  it('engages and clears the emergency stop, with an event for each', () => {
    const dir = freshDir()
    expect(() => make(dir).setEmergencyStop(true, T0, 'no run yet')).toThrow(/no run/)
    const store = make(dir)
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })

    expect(store.setEmergencyStop(true, T0, 'operator').emergencyStop).toBe(true)
    expect(store.setEmergencyStop(false, T0, 'operator').emergencyStop).toBe(false)
    expect(store.readEvents().map((event: any) => event.kind)).toEqual([
      'RUN_STARTED', 'EMERGENCY_STOP_ENGAGED', 'EMERGENCY_STOP_CLEARED',
    ])
  })
})

describe('what the ledger can do that the files cannot', () => {
  /** Make the next events INSERT fail, the way a full disk would. */
  function breakEventWrites(ledger: ControlPlaneLedger) {
    const prepare = ledger.db.prepare.bind(ledger.db)
    ledger.db.prepare = (sql: string) => {
      if (sql.startsWith('INSERT INTO events')) throw new Error('no space left on device')
      return prepare(sql)
    }
    return () => { ledger.db.prepare = prepare }
  }

  it('lands a state change and the record of it together, or not at all', () => {
    const ledger = ledgerIn(freshDir())
    ledger.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    ledger.upsertTask({ id: 'a', order: 1, handler: 'h' })

    const repair = breakEventWrites(ledger)
    expect(() => ledger.transition('a', 'WAITING_CI', { at: T0, evidence: 'pushed' }))
      .toThrow(/no space left/)
    repair()

    // The task did not move, because the record of it moving could not be
    // written. A ledger that disagrees with itself is worse than one that
    // refused.
    expect(ledger.loadTasks().a?.status).toBe('QUEUED')
    expect(ledger.readEvents().filter((event: any) => event.kind === 'TASK_TRANSITION')).toEqual([])
  })

  it('is the difference: the files move the task and lose the record', () => {
    // Measured rather than asserted, because it is the whole argument for the
    // ledger. Same fault, same sequence, opposite outcome.
    const store = new ControlPlaneStore(freshDir())
    store.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    store.upsertTask({ id: 'a', order: 1, handler: 'h' })

    const appendEvent = store.appendEvent.bind(store)
    store.appendEvent = () => { throw new Error('no space left on device') }
    expect(() => store.transition('a', 'WAITING_CI', { at: T0, evidence: 'pushed' }))
      .toThrow(/no space left/)
    store.appendEvent = appendEvent

    expect(store.loadTasks().a?.status).toBe('WAITING_CI')
    expect(store.readEvents().filter((event: any) => event.kind === 'TASK_TRANSITION')).toEqual([])
  })

  it('shows one handle the state another handle already committed', () => {
    const dir = freshDir()
    const first = ledgerIn(dir)
    const second = ledgerIn(dir)
    first.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    first.upsertTask({ id: 'a', order: 1, handler: 'h' })

    // Each transaction re-reads inside its own write lock, so an attempt
    // recorded through one handle is visible to — and counted by — the other.
    first.recordAttempt('a', { at: T0, failureClass: 'AUTH_REQUIRED' })
    expect(second.recordAttempt('a', { at: T0, failureClass: 'AUTH_REQUIRED' })).toMatchObject({
      attempts: 2, repeatedFailures: 1,
    })
  })
})

describe('choosing a backend, and moving an existing run into the ledger', () => {
  it('defaults to the ledger and can be sent back to the files', () => {
    const dir = freshDir()
    const chosen = openControlPlaneState({ dir })
    open.push(chosen as { close?: () => void })
    expect(chosen).toBeInstanceOf(ControlPlaneLedger)

    // A backend nobody can leave is a backend nobody can debug.
    expect(openControlPlaneState({ dir: freshDir(), backend: 'files' })).not.toBeInstanceOf(ControlPlaneLedger)
    expect(() => openControlPlaneState({ dir: freshDir(), backend: 'postgres' })).toThrow(/unknown control-plane state backend/)
  })

  it('carries an existing file-backed run across, history and all', () => {
    const dir = freshDir()
    const files = new ControlPlaneStore(dir)
    const run = files.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    files.upsertTask({ id: 'a', order: 1, handler: 'h' })
    files.transition('a', 'WAITING_CI', { at: T0, evidence: 'pushed' })
    files.saveCheckpoint('a', { at: T0, sha: 'abc1234', completed: 'branch pushed' })

    const ledger = openControlPlaneState({ dir }) as ControlPlaneLedger
    open.push(ledger)

    expect(ledger.loadRun()?.runId).toBe(run.runId)
    expect(ledger.loadTasks().a?.status).toBe('WAITING_CI')
    expect(ledger.getCheckpoint('a')).toMatchObject({ sha: 'abc1234' })
    // The log is carried verbatim rather than summarised into one entry: an
    // imported history has to read as what was recorded.
    expect(ledger.readEvents().map((event: any) => event.kind)).toEqual([
      'RUN_STARTED', 'TASK_TRANSITION', 'CHECKPOINT',
    ])
  })

  it('is a migration, not a merge: a ledger that already has a run is left alone', () => {
    const dir = freshDir()
    const files = new ControlPlaneStore(dir)
    files.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })

    const ledger = ledgerIn(dir)
    const own = ledger.startRun({ hardStop: HARD_STOP, mode: 'OBSERVE_ONLY', now: T0 })

    expect(importFromFiles(ledger, dir)).toMatchObject({ imported: false, reason: /already holds a run/ })
    expect(ledger.loadRun()?.runId).toBe(own.runId)
  })

  it('imports nothing when there is nothing to import', () => {
    const dir = freshDir()
    expect(importFromFiles(ledgerIn(dir), dir)).toMatchObject({ imported: false, reason: /no file-backed run/ })
  })

  it('does not carry the lease, which the importing writer should take for itself', () => {
    const dir = freshDir()
    const files = new ControlPlaneStore(dir)
    files.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0 })
    files.acquireLease('a-process-that-is-gone', { at: T0, ttlMs: 60 * 60 * 1000 })

    const ledger = openControlPlaneState({ dir }) as ControlPlaneLedger
    open.push(ledger)

    // A lease is held with a TTL precisely so a crashed holder frees the lane.
    // Importing one would hand the new writer a lock nobody is holding.
    expect(ledger.acquireLease('the-new-writer', { at: T0 }).acquired).toBe(true)
  })
})
