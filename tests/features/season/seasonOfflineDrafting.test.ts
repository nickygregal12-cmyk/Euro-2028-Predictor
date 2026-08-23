import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createSeasonMatchPredictorGateway } from '../../../src/dev/seasonMatchPredictorGateway'
import { instantFor } from '../../../src/dev/seasonPreviewFixture'
import {
  useSeasonMatchPredictor,
  type OfflineDraftingOptions,
} from '../../../src/features/season/useSeasonMatchPredictor'
import type { MatchPredictorGateway } from '../../../src/features/season/matchPredictorModel'
import type { DraftStorage } from '../../../src/services/offline/predictionDraftStore'
import { mapPredictionBatchResult } from '../../../src/services/supabase/seasonPredictionBatchModel'

/**
 * `INNOV-020` end to end through the hook, over contract 177's answer shape.
 *
 * THE ASSERTION THAT MATTERS MOST IS NEGATIVE: at no point before the server
 * answers `accepted` does anything in this view claim the prediction is
 * submitted. The drafts view has no such state, and the tests below check the
 * transitions in and out of the states it does have.
 *
 * The batch is a stub rather than the real gateway, because contract 177 lives
 * on the server and the seam this exercise needs is the gateway's `reconcile`.
 */

const BEFORE_LOCK = () => instantFor(1, -180)

function memoryStorage(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

type Harness = {
  storage: DraftStorage & { map: Map<string, string> }
  offline: OfflineDraftingOptions
  online: () => void
  setOnline: (value: boolean) => void
}

function harness(storage = memoryStorage()): Harness {
  let online = true
  const listeners = new Set<() => void>()
  return {
    storage,
    online: () => listeners.forEach((listener) => listener()),
    setOnline: (value) => {
      online = value
    },
    offline: {
      storage,
      scope: { userId: 'user-a', tournamentId: 'season-1', matchweek: 1 },
      now: () => new Date('2026-08-12T14:32:00.000Z'),
      isOnline: () => online,
      subscribeOnline: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
  }
}

/** A gateway whose saves fail — the offline case — with a stubbed batch path. */
function offlineGateway(
  reconcile: MatchPredictorGateway['reconcile'],
): MatchPredictorGateway {
  const base = createSeasonMatchPredictorGateway({
    scenario: 'save_failure',
    now: BEFORE_LOCK(),
  })
  return {
    load: base.load.bind(base),
    apply: base.apply.bind(base),
    ...(reconcile ? { reconcile } : {}),
  }
}

const batch = (results: unknown[]) =>
  mapPredictionBatchResult({
    server_now: '2026-08-12T14:32:00Z',
    submitted: results.length,
    accepted: results.filter((row) => (row as { outcome?: string }).outcome === 'accepted').length,
    rejected: results.filter((row) => (row as { outcome?: string }).outcome !== 'accepted').length,
    results,
  })

describe('offline drafting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is entirely absent when no offline options are supplied', async () => {
    const gateway = createSeasonMatchPredictorGateway({ scenario: 'healthy', now: BEFORE_LOCK() })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.drafts).toBeNull()
  })

  it('holds an edit on the device when the save does not reach the server', async () => {
    const bench = harness()
    const gateway = offlineGateway(async () => batch([]))
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1, bench.offline))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 2, away: 1 })
    })

    await waitFor(() => expect(result.current.drafts?.pending).toBe(1))
    expect(result.current.drafts?.fixtures[0]).toMatchObject({
      fixtureId,
      state: 'draft',
      prediction: { home: 2, away: 1 },
    })
    // Nothing in the view says submitted, saved or sent.
    expect(bench.storage.map.size).toBe(1)
  })

  it('restores drafts after a reload, because a reload with no signal is the case', async () => {
    const bench = harness()
    const gateway = offlineGateway(async () => batch([]))
    const first = renderHook(() => useSeasonMatchPredictor(gateway, 1, bench.offline))
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    const fixtureId = first.result.current.page!.fixtures[0]!.fixtureId
    act(() => {
      first.result.current.setPrediction(fixtureId, { home: 4, away: 2 })
    })
    await waitFor(() => expect(first.result.current.drafts?.pending).toBe(1))
    first.unmount()

    const second = renderHook(() => useSeasonMatchPredictor(gateway, 1, bench.offline))
    await waitFor(() => expect(second.result.current.drafts?.pending).toBe(1))
    expect(second.result.current.drafts?.fixtures[0]?.prediction).toEqual({ home: 4, away: 2 })
  })

  it('sends only unrefused drafts, and clears exactly what the server accepted', async () => {
    const bench = harness()
    const sent: unknown[] = []
    const gateway = offlineGateway(async (_matchweek, drafts) => {
      sent.push(drafts.map((draft) => draft.fixtureId))
      return batch([
        { fixture_id: drafts[0]!.fixtureId, outcome: 'accepted', cleared: false, version: 3 },
        {
          fixture_id: drafts[1]!.fixtureId,
          outcome: 'locked',
          reason: 'This matchweek has locked',
        },
      ])
    })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1, bench.offline))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const [one, two] = result.current.page!.fixtures

    act(() => {
      result.current.setPrediction(one!.fixtureId, { home: 1, away: 0 })
      result.current.setPrediction(two!.fixtureId, { home: 2, away: 2 })
    })
    await waitFor(() => expect(result.current.drafts?.pending).toBe(2))

    act(() => {
      result.current.syncDrafts()
    })

    await waitFor(() => expect(result.current.drafts?.blocked).toBe(1))
    expect(sent[0]).toEqual([one!.fixtureId, two!.fixtureId])
    // The accepted one is gone; the locked one stays with the server's sentence
    // and is never re-sent.
    expect(result.current.drafts?.fixtures.map((fixture) => fixture.fixtureId)).toEqual([
      two!.fixtureId,
    ])
    expect(result.current.drafts?.fixtures[0]?.state).toBe('locked')
    expect(result.current.drafts?.fixtures[0]?.refusal?.reason).toBe('This matchweek has locked')
    expect(result.current.drafts?.pending).toBe(0)
    expect(result.current.drafts?.lastResult).toEqual({ accepted: 1, rejected: 1 })
  })

  it('puts both scorelines in front of the player on a version conflict', async () => {
    const bench = harness()
    const gateway = offlineGateway(async (_matchweek, drafts) =>
      batch([
        {
          fixture_id: drafts[0]!.fixtureId,
          outcome: 'conflict',
          reason: 'Another device submitted this fixture after this draft was taken',
          stored: { version: 7, home: 3, away: 3 },
          draft: { version: 2, home: 1, away: 0 },
        },
      ]),
    )
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1, bench.offline))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 0 })
    })
    await waitFor(() => expect(result.current.drafts?.pending).toBe(1))
    act(() => {
      result.current.syncDrafts()
    })

    await waitFor(() => expect(result.current.drafts?.fixtures[0]?.state).toBe('conflict'))
    expect(result.current.drafts?.fixtures[0]?.refusal?.stored).toEqual({ home: 3, away: 3 })
    expect(result.current.drafts?.fixtures[0]?.prediction).toEqual({ home: 1, away: 0 })
  })

  it('discards a draft only when asked, and never on its own', async () => {
    const bench = harness()
    const gateway = offlineGateway(async (_matchweek, drafts) =>
      batch([
        { fixture_id: drafts[0]!.fixtureId, outcome: 'locked', reason: 'This matchweek has locked' },
      ]),
    )
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1, bench.offline))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 0 })
    })
    await waitFor(() => expect(result.current.drafts?.pending).toBe(1))
    act(() => {
      result.current.syncDrafts()
    })
    await waitFor(() => expect(result.current.drafts?.blocked).toBe(1))

    // A second sync leaves it exactly where it is: refused is not retried.
    act(() => {
      result.current.syncDrafts()
    })
    expect(result.current.drafts?.blocked).toBe(1)

    act(() => {
      result.current.discardDraft(fixtureId)
    })
    await waitFor(() => expect(result.current.drafts?.fixtures).toHaveLength(0))
    expect(bench.storage.map.size).toBe(0)
  })

  it('reconciles by itself when the device says it is back online', async () => {
    const bench = harness()
    const reconcile = vi.fn(async (_matchweek: number, drafts: readonly { fixtureId: string }[]) =>
      batch([{ fixture_id: drafts[0]!.fixtureId, outcome: 'accepted', cleared: false, version: 1 }]),
    )
    const gateway = offlineGateway(reconcile)
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1, bench.offline))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 0 })
    })
    await waitFor(() => expect(result.current.drafts?.pending).toBe(1))

    act(() => {
      bench.online()
    })

    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.drafts?.fixtures).toHaveLength(0))
  })

  it('keeps every draft when the reconciliation itself fails', async () => {
    const bench = harness()
    const gateway = offlineGateway(async () => {
      throw new Error('still no connection')
    })
    const { result } = renderHook(() => useSeasonMatchPredictor(gateway, 1, bench.offline))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const fixtureId = result.current.page!.fixtures[0]!.fixtureId

    act(() => {
      result.current.setPrediction(fixtureId, { home: 1, away: 0 })
    })
    await waitFor(() => expect(result.current.drafts?.pending).toBe(1))

    bench.setOnline(false)
    act(() => {
      result.current.syncDrafts()
    })

    await waitFor(() => expect(result.current.drafts?.syncing).toBe(false))
    expect(result.current.drafts?.pending).toBe(1)
    expect(result.current.drafts?.offline).toBe(true)
  })

  it('cannot see another account’s drafts on the same device', async () => {
    const shared = memoryStorage()
    const mine = harness(shared)
    const gateway = offlineGateway(async () => batch([]))
    const first = renderHook(() => useSeasonMatchPredictor(gateway, 1, mine.offline))
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    const fixtureId = first.result.current.page!.fixtures[0]!.fixtureId
    act(() => {
      first.result.current.setPrediction(fixtureId, { home: 9, away: 9 })
    })
    await waitFor(() => expect(first.result.current.drafts?.pending).toBe(1))
    first.unmount()

    const theirs = harness(shared)
    const second = renderHook(() =>
      useSeasonMatchPredictor(gateway, 1, {
        ...theirs.offline,
        scope: { ...theirs.offline.scope, userId: 'user-b' },
      }),
    )
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(second.result.current.drafts?.fixtures).toHaveLength(0)
  })
})
