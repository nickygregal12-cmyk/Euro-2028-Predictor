import { describe, it, expect } from 'vitest'
import {
  initSaveState,
  reduceSave,
  backoffDelay,
  AUTO_RETRY_LIMIT,
  RETRY_MAX_MS,
  type SaveState,
  type SaveEvent,
  type SaveEffect,
} from '../../src/domain/saveCoordinator'

// The pure save-ordering machine. A "save" here carries a string payload so the
// tests can prove WHICH payload is issued at each step (i.e. that stale ones are
// never sent and the latest pending wins).

type P = string

// Drive a sequence of events from the initial state, returning the final state
// and the flat list of effects produced along the way.
function run(events: SaveEvent<P>[], start: SaveState<P> = initSaveState<P>()) {
  let state = start
  const effects: SaveEffect<P>[] = []
  for (const e of events) {
    const r = reduceSave(state, e)
    state = r.state
    effects.push(...r.effects)
  }
  return { state, effects }
}

const saves = (effects: SaveEffect<P>[]) =>
  effects.filter((e): e is Extract<SaveEffect<P>, { type: 'save' }> => e.type === 'save')

describe('reduceSave — issuing', () => {
  it('a change from idle is saved immediately, one in-flight', () => {
    const { state, effects } = run([{ type: 'change', payload: 'a' }])
    expect(saves(effects)).toEqual([{ type: 'save', seq: 1, payload: 'a' }])
    expect(state.status).toBe('saving')
    expect(state.inFlight).toBe(true)
    expect(state.active).toEqual({ seq: 1, payload: 'a' })
    expect(state.pending).toBeNull()
  })

  it('success moves to saved and nothing else is issued', () => {
    const { state, effects } = run([
      { type: 'change', payload: 'a' },
      { type: 'result', seq: 1, ok: true },
    ])
    expect(state.status).toBe('saved')
    expect(state.inFlight).toBe(false)
    expect(state.active).toBeNull()
    expect(saves(effects)).toHaveLength(1)
  })
})

describe('reduceSave — coalescing (at most one in-flight)', () => {
  it('changes during a flight coalesce; only the LATEST pending is sent next', () => {
    const { state, effects } = run([
      { type: 'change', payload: 'a' }, // seq 1 → issued
      { type: 'change', payload: 'b' }, // seq 2 → pending (coalesced, not sent)
      { type: 'change', payload: 'c' }, // seq 3 → replaces pending b
    ])
    // Only 'a' has been sent so far; b and c did not each fire a save.
    expect(saves(effects)).toEqual([{ type: 'save', seq: 1, payload: 'a' }])
    expect(state.pending).toEqual({ seq: 3, payload: 'c' })

    // When 'a' settles, the latest pending 'c' saves next — 'b' is never sent.
    const after = reduceSave(state, { type: 'result', seq: 1, ok: true })
    expect(saves(after.effects)).toEqual([{ type: 'save', seq: 3, payload: 'c' }])
    expect(after.state.pending).toBeNull()
    expect(after.state.active).toEqual({ seq: 3, payload: 'c' })
  })

  it('never has two saves in flight for the same key', () => {
    // Fire many changes without any settling; exactly one save is ever issued.
    const events: SaveEvent<P>[] = []
    for (let i = 0; i < 10; i++) events.push({ type: 'change', payload: `v${i}` })
    const { state, effects } = run(events)
    expect(saves(effects)).toHaveLength(1)
    expect(state.inFlight).toBe(true)
    expect(state.pending).toEqual({ seq: 10, payload: 'v9' })
  })
})

describe('reduceSave — stale responses never overwrite newer state', () => {
  it('ignores a response whose seq is not the in-flight request', () => {
    // 'a' issued (seq1), 'b' coalesced (seq2), 'a' settles → 'b' issued (seq2).
    const base = run([
      { type: 'change', payload: 'a' },
      { type: 'change', payload: 'b' },
      { type: 'result', seq: 1, ok: true },
    ]).state
    expect(base.active).toEqual({ seq: 2, payload: 'b' })

    // A late response for the OLD seq 1 must be ignored — no status change.
    const stale = reduceSave(base, { type: 'result', seq: 1, ok: false })
    expect(stale.effects).toHaveLength(0)
    expect(stale.state).toEqual(base)
    expect(stale.state.status).toBe('saving')
  })

  it('a stale failure does not flip a newer in-flight save to error', () => {
    // Two overlapping issues via retry supersession: ensure old failure ignored.
    let s = run([{ type: 'change', payload: 'a' }]).state // seq1 in flight
    // 'a' fails, no pending → schedules retry (attempt 1), still 'saving'.
    s = reduceSave(s, { type: 'result', seq: 1, ok: false }).state
    expect(s.status).toBe('saving')
    // A newer change 'b' supersedes the waiting retry (seq2 issued).
    const sup = reduceSave(s, { type: 'change', payload: 'b' })
    expect(saves(sup.effects)).toEqual([{ type: 'save', seq: 2, payload: 'b' }])
    s = sup.state
    // The OLD retry timer for seq1 fires late → ignored (seq mismatch).
    const late = reduceSave(s, { type: 'retryTimer', seq: 1 })
    expect(late.effects).toHaveLength(0)
    expect(late.state).toEqual(s)
  })
})

describe('reduceSave — retry with backoff then manual error', () => {
  it('auto-retries up to the limit, then surfaces error', () => {
    let s = run([{ type: 'change', payload: 'a' }]).state
    const scheduled: number[] = []
    // Fail repeatedly, firing each scheduled retry.
    for (let i = 0; i < AUTO_RETRY_LIMIT; i++) {
      const r = reduceSave(s, { type: 'result', seq: 1, ok: false })
      s = r.state
      expect(s.status).toBe('saving') // retrying is shown as 'saving', not a new state
      const retry = r.effects.find((e) => e.type === 'scheduleRetry')
      expect(retry && retry.type === 'scheduleRetry').toBe(true)
      if (retry && retry.type === 'scheduleRetry') scheduled.push(retry.delayMs)
      // Backoff timer fires → re-issue the SAME payload.
      const fired = reduceSave(s, { type: 'retryTimer', seq: 1 })
      expect(saves(fired.effects)).toEqual([{ type: 'save', seq: 1, payload: 'a' }])
      s = fired.state
    }
    // One more failure exceeds the limit → error, no further retry scheduled.
    const final = reduceSave(s, { type: 'result', seq: 1, ok: false })
    expect(final.state.status).toBe('error')
    expect(final.effects.find((e) => e.type === 'scheduleRetry')).toBeUndefined()
    // The failed payload is retained so a manual retry can re-send it.
    expect(final.state.active).toEqual({ seq: 1, payload: 'a' })
    // Backoff grew geometrically.
    expect(scheduled).toEqual([backoffDelay(1), backoffDelay(2)])
    expect(scheduled[1]).toBeGreaterThan(scheduled[0])
  })

  it('manual retry re-sends the failed payload and resets attempts', () => {
    // Get into the error state.
    let s = run([{ type: 'change', payload: 'a' }]).state
    for (let i = 0; i <= AUTO_RETRY_LIMIT; i++) {
      s = reduceSave(s, { type: 'result', seq: 1, ok: false }).state
      if (s.inFlight === false && s.active && s.status === 'saving') {
        s = reduceSave(s, { type: 'retryTimer', seq: 1 }).state
      }
    }
    expect(s.status).toBe('error')

    const retry = reduceSave(s, { type: 'manualRetry' })
    expect(saves(retry.effects)).toEqual([{ type: 'save', seq: 1, payload: 'a' }])
    expect(retry.state.status).toBe('saving')
    expect(retry.state.attempt).toBe(0)
    expect(retry.state.inFlight).toBe(true)
  })

  it('a newer change while a save is failing abandons the failed payload', () => {
    let s = run([
      { type: 'change', payload: 'a' }, // seq1 issued
      { type: 'change', payload: 'b' }, // seq2 pending
    ]).state
    // 'a' fails but 'b' is waiting → issue 'b' (don't retry stale 'a').
    const r = reduceSave(s, { type: 'result', seq: 1, ok: false })
    expect(saves(r.effects)).toEqual([{ type: 'save', seq: 2, payload: 'b' }])
    expect(r.state.attempt).toBe(0)
    expect(r.state.pending).toBeNull()
    s = r.state
  })
})

describe('reduceSave — guards / no-ops', () => {
  it('manualRetry is a no-op when idle or already in flight', () => {
    expect(reduceSave(initSaveState<P>(), { type: 'manualRetry' }).effects).toHaveLength(0)
    const inflight = run([{ type: 'change', payload: 'a' }]).state
    const r = reduceSave(inflight, { type: 'manualRetry' })
    expect(r.effects).toHaveLength(0)
    expect(r.state).toEqual(inflight)
  })

  it('retryTimer is a no-op when a save is already in flight', () => {
    const inflight = run([{ type: 'change', payload: 'a' }]).state
    const r = reduceSave(inflight, { type: 'retryTimer', seq: 1 })
    expect(r.effects).toHaveLength(0)
  })

  it('a change while in error/backoff cancels the retry before re-issuing', () => {
    let s = run([{ type: 'change', payload: 'a' }]).state
    s = reduceSave(s, { type: 'result', seq: 1, ok: false }).state // waiting to retry
    const r = reduceSave(s, { type: 'change', payload: 'b' })
    expect(r.effects.some((e) => e.type === 'cancelRetry')).toBe(true)
    expect(saves(r.effects)).toEqual([{ type: 'save', seq: 2, payload: 'b' }])
  })
})

describe('backoffDelay', () => {
  it('grows geometrically and caps', () => {
    expect(backoffDelay(1)).toBe(500)
    expect(backoffDelay(2)).toBe(1500)
    expect(backoffDelay(3)).toBe(4500)
    expect(backoffDelay(10)).toBe(RETRY_MAX_MS)
  })
})
