import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { renderText, summariseRun } from '../../scripts/control-plane/report.mjs'
import { ControlPlaneStore } from '../../scripts/control-plane/state.mjs'

const T0 = '2026-08-26T03:00:00.000Z'
const HARD_STOP = '2026-08-27T00:00:00.000Z'

function store() {
  return new ControlPlaneStore(mkdtempSync(resolve(tmpdir(), 'predictor-report-')))
}

function started(overrides: Record<string, unknown> = {}) {
  const s = store()
  s.startRun({ hardStop: HARD_STOP, mode: 'ACTIVE', now: T0, maxPullRequests: 1 })
  if (Object.keys(overrides).length > 0) s.saveRun({ ...s.loadRun(), ...overrides })
  return s
}

describe('the verdict answers "does this need me"', () => {
  it('says so when there is no run at all', () => {
    expect(summariseRun(store(), { now: T0 })).toMatchObject({ verdict: 'NO_RUN' })
    expect(renderText(summariseRun(store(), { now: T0 }))).toContain('NO RUN')
  })

  it('leads with the one thing waiting on a person, not with a list of fourteen rows', () => {
    const s = started()
    for (const id of ['a', 'b', 'c']) s.upsertTask({ id, order: 1, handler: 'h' })
    s.transition('a', 'COMPLETED', { at: T0 })
    s.transition('b', 'WAITING_CI', { at: T0 })
    s.transition('c', 'WAITING_OWNER', { at: T0, blocker: 'REPAIR_CI', nextAction: 'fix the branch' })

    const summary = summariseRun(s, { now: T0 })

    expect(summary.verdict).toBe('NEEDS_YOU')
    expect(summary.headline).toBe('c: fix the branch')
    // The headline IS the item when there is one, so the section is not
    // repeated underneath it.
    expect(renderText(summary)).not.toContain('WAITING ON YOU')
  })

  it('lists them once there is more than one', () => {
    const s = started()
    for (const id of ['a', 'b']) {
      s.upsertTask({ id, order: 1, handler: 'h' })
      s.transition(id, 'WAITING_OWNER', { at: T0, nextAction: `decide ${id}` })
    }

    const rendered = renderText(summariseRun(s, { now: T0 }))

    expect(rendered).toContain('2 tasks are waiting on you')
    expect(rendered).toContain('WAITING ON YOU')
    expect(rendered).toContain('decide b')
  })

  it('puts a stopped programme above everything else that is true', () => {
    const s = started()
    s.upsertTask({ id: 'c', order: 1, handler: 'h' })
    s.transition('c', 'WAITING_OWNER', { at: T0, nextAction: 'decide' })
    s.setEmergencyStop(true, T0, 'operator')

    // A stopped programme is stopped whatever else is waiting.
    expect(summariseRun(s, { now: T0 })).toMatchObject({ verdict: 'STOPPED' })
    expect(renderText(summariseRun(s, { now: T0 }))).toContain('EMERGENCY STOP ENGAGED')
  })

  it('reads a passed hard stop as stopped, not as working', () => {
    const s = started()
    s.upsertTask({ id: 'a', order: 1, handler: 'h' })

    expect(summariseRun(s, { now: '2026-08-28T00:00:00.000Z' })).toMatchObject({ verdict: 'STOPPED' })
    expect(summariseRun(s, { now: T0 }).verdict).toBe('WORKING')
  })

  it('separates waiting on a machine from waiting on a person', () => {
    const s = started()
    s.upsertTask({ id: 'p', order: 1, handler: 'h' })
    s.transition('p', 'WAITING_CI', { at: T0, nextAction: 'observe this head again' })

    const summary = summariseRun(s, { now: T0 })

    // Only one of the two will resolve itself.
    expect(summary.verdict).toBe('WAITING')
    expect(renderText(summary)).toContain('WAITING ON SOMETHING ELSE')
  })

  it('does not call a dependency-blocked task runnable', () => {
    // Measured against a real canary ledger: the only QUEUED task was
    // `delivery.merge`, which depends on a parked push and can never be
    // dispatched, and the report read WORKING. A control room that says
    // WORKING while nothing works is worse than one that says nothing.
    const s = started()
    s.upsertTask({ id: 'push', order: 1, handler: 'h', mutating: true })
    s.upsertTask({ id: 'merge', order: 2, handler: 'h', dependencies: ['push'] })
    s.transition('push', 'WAITING_CI', { at: T0, nextAction: 'a watcher supplies check evidence' })

    const summary = summariseRun(s, { now: T0 })

    expect(summary.running).toEqual([])
    expect(summary.verdict).toBe('WAITING')
  })

  it('says when everything is done', () => {
    const s = started()
    s.upsertTask({ id: 'a', order: 1, handler: 'h' })
    s.transition('a', 'COMPLETED', { at: T0 })

    expect(summariseRun(s, { now: T0 })).toMatchObject({ verdict: 'DONE' })
  })

  it('reports a blocked queue when nothing else can run', () => {
    const s = started()
    s.upsertTask({ id: 'a', order: 1, handler: 'h' })
    s.transition('a', 'BLOCKED', { at: T0, blocker: 'attempts_exhausted' })

    const summary = summariseRun(s, { now: T0 })

    expect(summary.verdict).toBe('BLOCKED')
    expect(renderText(summary)).toContain('attempts_exhausted')
  })
})

describe('what it shows, and what it leaves out', () => {
  it('shows a provider only while something is wrong with it', () => {
    const s = started({
      providerHealth: {
        'a': { id: 'a', state: 'READY' },
        'b': { id: 'b', state: 'COOLING', reason: 'PROVIDER_LIMIT', until: '2026-08-26T03:15:00.000Z' },
      },
    })
    s.upsertTask({ id: 't', order: 1, handler: 'h' })

    const rendered = renderText(summariseRun(s, { now: T0 }))

    expect(rendered).toContain('b — cooling after PROVIDER_LIMIT')
    expect(rendered).not.toContain('a — ')
  })

  it('omits an empty section rather than printing "none"', () => {
    const s = started()
    s.upsertTask({ id: 't', order: 1, handler: 'h' })

    const rendered = renderText(summariseRun(s, { now: T0 }))

    // A screen that always shows the same headings trains the reader to skip
    // them, and the one time a heading has something under it is the time they
    // will not look.
    for (const heading of ['WAITING ON YOU', 'WAITING ON SOMETHING ELSE', 'BLOCKED', 'PROVIDERS']) {
      expect(rendered, heading).not.toContain(heading)
    }
    expect(rendered).toContain('RUN')
  })

  it('changes nothing it reads', () => {
    const s = started()
    s.upsertTask({ id: 't', order: 1, handler: 'h' })
    const before = JSON.stringify({ run: s.loadRun(), tasks: s.loadTasks(), events: s.readEvents() })

    renderText(summariseRun(s, { now: T0 }))

    // A reporting layer that could act would be a second place the programme
    // advances, and the design has one.
    expect(JSON.stringify({ run: s.loadRun(), tasks: s.loadTasks(), events: s.readEvents() })).toBe(before)
  })
})
