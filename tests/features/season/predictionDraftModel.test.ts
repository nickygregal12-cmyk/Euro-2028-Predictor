import { describe, expect, it } from 'vitest'
import {
  applyBatchResult,
  pendingDrafts,
  presentDrafts,
  removeDraft,
  retryDraft,
  upsertDraft,
} from '../../../src/features/season/predictionDraftModel'
import { mapPredictionBatchResult } from '../../../src/services/supabase/seasonPredictionBatchModel'
import type { PredictionDraft } from '../../../src/services/offline/predictionDraftStore'

/**
 * `INNOV-020`'s reconciliation, as arithmetic.
 *
 * The safety property under test throughout is the same one: nothing removes a
 * draft except the server saying `accepted`, or the player discarding it. A
 * partial batch must leave the rejected work exactly where it was, carrying the
 * server's own reason, and must not re-send it on the next attempt.
 */

const drafts: readonly PredictionDraft[] = [
  { fixtureId: 'fx-1', prediction: { home: 2, away: 1 } },
  { fixtureId: 'fx-2', prediction: { home: 0, away: 0 } },
  { fixtureId: 'fx-3', prediction: { home: 1, away: 3 } },
  { fixtureId: 'fx-4', prediction: null },
]

const batch = (results: unknown[]) =>
  mapPredictionBatchResult({
    server_now: '2026-08-12T14:32:00Z',
    submitted: results.length,
    accepted: results.filter((row) => (row as { outcome?: string }).outcome === 'accepted').length,
    rejected: results.filter((row) => (row as { outcome?: string }).outcome !== 'accepted').length,
    results,
  })

describe('applyBatchResult', () => {
  it('removes only what the server accepted, and keeps the rest with its reason', () => {
    const next = applyBatchResult(
      drafts,
      batch([
        { fixture_id: 'fx-1', outcome: 'accepted', cleared: false, version: 4 },
        { fixture_id: 'fx-2', outcome: 'locked', reason: 'This matchweek has locked' },
        {
          fixture_id: 'fx-3',
          outcome: 'conflict',
          reason: 'Another device submitted this fixture after this draft was taken',
          stored: { version: 7, home: 2, away: 2 },
          draft: { version: 3, home: 1, away: 3 },
        },
        { fixture_id: 'fx-4', outcome: 'accepted', cleared: true, version: null },
      ]),
    )

    expect(next.map((draft) => draft.fixtureId)).toEqual(['fx-2', 'fx-3'])
    expect(next[0]?.refusal).toEqual({
      outcome: 'locked',
      reason: 'This matchweek has locked',
      stored: null,
    })
    expect(next[1]?.refusal?.stored).toEqual({ home: 2, away: 2 })
    // The player's own drafted scoreline survives the conflict untouched: the
    // choice between the two is theirs, and losing one half of it removes the
    // choice.
    expect(next[1]?.prediction).toEqual({ home: 1, away: 3 })
  })

  it('leaves a draft the server did not mention exactly as it was', () => {
    const next = applyBatchResult(
      drafts,
      batch([{ fixture_id: 'fx-1', outcome: 'accepted', cleared: false, version: 4 }]),
    )
    expect(next.map((draft) => draft.fixtureId)).toEqual(['fx-2', 'fx-3', 'fx-4'])
    expect(next.every((draft) => draft.refusal === undefined)).toBe(true)
  })

  it('treats an outcome it does not recognise as refused, never as accepted', () => {
    const next = applyBatchResult(
      drafts.slice(0, 1),
      batch([{ fixture_id: 'fx-1', outcome: 'transcended', reason: 'who knows' }]),
    )
    expect(next).toHaveLength(1)
    expect(next[0]?.refusal?.outcome).toBe('refused')
  })
})

describe('pendingDrafts', () => {
  it('never re-sends a draft the server has already refused', () => {
    const after = applyBatchResult(
      drafts,
      batch([{ fixture_id: 'fx-2', outcome: 'locked', reason: 'This matchweek has locked' }]),
    )
    expect(pendingDrafts(after).map((draft) => draft.fixtureId)).toEqual(['fx-1', 'fx-3', 'fx-4'])
  })
})

describe('editing a draft', () => {
  it('replaces in place and keeps the order of the others', () => {
    const next = upsertDraft(drafts, 'fx-2', { home: 4, away: 4 })
    expect(next.map((draft) => draft.fixtureId)).toEqual(['fx-1', 'fx-2', 'fx-3', 'fx-4'])
    expect(next[1]?.prediction).toEqual({ home: 4, away: 4 })
  })

  it('appends a fixture that had no draft', () => {
    const next = upsertDraft(drafts, 'fx-9', { home: 1, away: 0 })
    expect(next).toHaveLength(5)
    expect(next[4]).toEqual({ fixtureId: 'fx-9', prediction: { home: 1, away: 0 } })
  })

  it('clears a previous refusal, because typing something else answers it', () => {
    const refused = applyBatchResult(
      drafts.slice(0, 1),
      batch([{ fixture_id: 'fx-1', outcome: 'conflict', reason: 'moved', stored: { version: 2, home: 1, away: 1 } }]),
    )
    expect(upsertDraft(refused, 'fx-1', { home: 5, away: 0 })[0]?.refusal).toBeUndefined()
  })

  it('discards one draft and nothing else', () => {
    expect(removeDraft(drafts, 'fx-3').map((draft) => draft.fixtureId)).toEqual([
      'fx-1',
      'fx-2',
      'fx-4',
    ])
  })

  it('makes a refused draft pending again without changing what it holds', () => {
    const refused = applyBatchResult(
      drafts.slice(0, 1),
      batch([{ fixture_id: 'fx-1', outcome: 'conflict', reason: 'moved', stored: { version: 2, home: 1, away: 1 } }]),
    )
    const retried = retryDraft(refused, 'fx-1')
    expect(retried[0]).toEqual({ fixtureId: 'fx-1', prediction: { home: 2, away: 1 } })
    expect(pendingDrafts(retried)).toHaveLength(1)
  })
})

describe('presentDrafts', () => {
  it('counts pending and blocked apart, and names each state', () => {
    const after = applyBatchResult(
      drafts,
      batch([
        { fixture_id: 'fx-1', outcome: 'accepted', cleared: false, version: 4 },
        { fixture_id: 'fx-2', outcome: 'locked', reason: 'locked' },
        { fixture_id: 'fx-3', outcome: 'conflict', reason: 'moved', stored: { version: 2, home: 1, away: 1 } },
      ]),
    )
    const view = presentDrafts(after, {
      syncing: false,
      offline: true,
      lastResult: { accepted: 1, rejected: 2 },
    })

    expect(view.fixtures.map((fixture) => fixture.state)).toEqual(['locked', 'conflict', 'draft'])
    expect(view.pending).toBe(1)
    expect(view.blocked).toBe(2)
    expect(view.offline).toBe(true)
    expect(view.lastResult).toEqual({ accepted: 1, rejected: 2 })
  })

  it('shows an unrefused draft as sending while a batch is on the wire', () => {
    const view = presentDrafts(drafts.slice(0, 1), {
      syncing: true,
      offline: false,
      lastResult: null,
    })
    expect(view.fixtures[0]?.state).toBe('syncing')
    // Still pending: on the wire is not accepted.
    expect(view.pending).toBe(1)
  })
})

describe('mapPredictionBatchResult', () => {
  it('refuses a payload it cannot read', () => {
    expect(() => mapPredictionBatchResult({ results: [] })).toThrow(/not in the expected shape/)
  })

  it('drops a result that names no fixture, because it cannot be matched to a draft', () => {
    const decoded = batch([{ outcome: 'accepted' }, { fixture_id: 'fx-1', outcome: 'accepted' }])
    expect(decoded.results.map((row) => row.fixtureId)).toEqual(['fx-1'])
  })

  it('carries both scorelines on a conflict and neither on anything else', () => {
    const decoded = batch([
      { fixture_id: 'fx-1', outcome: 'conflict', stored: { version: 2, home: 1, away: 1 }, draft: { version: 1, home: 3, away: 0 } },
      { fixture_id: 'fx-2', outcome: 'locked', stored: { version: 2, home: 1, away: 1 } },
    ])
    expect(decoded.results[0]?.stored).toEqual({ home: 1, away: 1, version: 2 })
    expect(decoded.results[0]?.draft).toEqual({ home: 3, away: 0, version: 1 })
    expect(decoded.results[1]?.stored).toBeNull()
  })
})
