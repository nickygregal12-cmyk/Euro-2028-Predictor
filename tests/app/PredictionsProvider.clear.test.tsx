import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PredictionsProvider,
  usePredictions,
} from '../../src/app/providers/PredictionsProvider'

const mocks = vi.hoisted(() => ({
  getOrCreateEntry: vi.fn(),
  fetchMatchPredictions: vi.fn(),
  upsertMatchPrediction: vi.fn(),
  deleteMatchPrediction: vi.fn(),
  submitEntry: vi.fn(),
  fetchGoldenBoot: vi.fn(),
  upsertGoldenBoot: vi.fn(),
  fetchTieResolutions: vi.fn(),
  upsertTieResolution: vi.fn(),
  fetchProgression: vi.fn(),
  upsertProgression: vi.fn(),
  deleteProgression: vi.fn(),
}))

vi.mock('../../src/services/supabase/predictions', () => ({
  getOrCreateEntry: mocks.getOrCreateEntry,
  fetchMatchPredictions: mocks.fetchMatchPredictions,
  upsertMatchPrediction: mocks.upsertMatchPrediction,
  deleteMatchPrediction: mocks.deleteMatchPrediction,
  submitEntry: mocks.submitEntry,
}))

vi.mock('../../src/services/supabase/bonus', () => ({
  fetchGoldenBoot: mocks.fetchGoldenBoot,
  upsertGoldenBoot: mocks.upsertGoldenBoot,
}))

vi.mock('../../src/services/supabase/tieResolutions', () => ({
  fetchTieResolutions: mocks.fetchTieResolutions,
  upsertTieResolution: mocks.upsertTieResolution,
}))

vi.mock('../../src/services/supabase/progression', () => ({
  fetchProgression: mocks.fetchProgression,
  upsertProgression: mocks.upsertProgression,
  deleteProgression: mocks.deleteProgression,
}))

vi.mock('../../src/services/supabase/writeConflict', () => ({
  isVersionConflict: (error: unknown) =>
    (error as { code?: string } | null)?.code === 'PT409',
}))

vi.mock('../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}))

vi.mock('../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: { id: 'tournament-1' },
      matches: [],
    },
  }),
}))

type PredictionsApi = ReturnType<typeof usePredictions>
let currentApi: PredictionsApi | null = null

function Harness() {
  currentApi = usePredictions()
  return null
}

async function renderReadyProvider() {
  render(
    <PredictionsProvider>
      <Harness />
    </PredictionsProvider>,
  )
  await waitFor(() => expect(currentApi?.ready).toBe(true))
  if (!currentApi) throw new Error('Predictions context did not mount')
  return currentApi
}

describe('PredictionsProvider persisted score clearing', () => {
  beforeEach(() => {
    currentApi = null
    vi.clearAllMocks()
    mocks.getOrCreateEntry.mockResolvedValue({ id: 'entry-1', submittedAt: null })
    mocks.fetchMatchPredictions.mockResolvedValue([])
    mocks.fetchGoldenBoot.mockResolvedValue({ playerId: null, version: 0 })
    mocks.fetchTieResolutions.mockResolvedValue([])
    mocks.fetchProgression.mockResolvedValue([])
    mocks.upsertMatchPrediction.mockResolvedValue(0)
    mocks.deleteMatchPrediction.mockResolvedValue(true)
    mocks.upsertGoldenBoot.mockResolvedValue(1)
    mocks.upsertTieResolution.mockResolvedValue(undefined)
    mocks.upsertProgression.mockResolvedValue(1)
    mocks.deleteProgression.mockResolvedValue(undefined)
    mocks.submitEntry.mockResolvedValue('2026-07-24T00:00:00.000Z')
  })

  afterEach(() => {
    currentApi = null
  })

  it('deletes a loaded score using the exact version the client read', async () => {
    mocks.fetchMatchPredictions.mockResolvedValue([
      {
        matchId: 'match-1',
        homeScore: 2,
        awayScore: 1,
        joker: true,
        version: 7,
      },
    ])

    const api = await renderReadyProvider()

    act(() => {
      api.setScore('match-1', 'away', null)
    })

    await waitFor(() => {
      expect(mocks.deleteMatchPrediction).toHaveBeenCalledWith(
        'entry-1',
        'match-1',
        7,
      )
      expect(currentApi?.getSaveStatus('match-1')).toBe('saved')
    })

    expect(currentApi?.getPrediction('match-1')).toEqual({
      homeScore: 2,
      awayScore: null,
      joker: true,
    })
    expect(mocks.upsertMatchPrediction).not.toHaveBeenCalled()
  })

  it('clears an unsent local score with an unknown expected version', async () => {
    const api = await renderReadyProvider()

    act(() => {
      api.setScore('match-1', 'home', 1)
      api.setScore('match-1', 'away', 0)
      api.setScore('match-1', 'away', null)
    })

    await waitFor(() => {
      expect(mocks.deleteMatchPrediction).toHaveBeenCalledWith(
        'entry-1',
        'match-1',
        null,
      )
    })

    // The 600ms upsert was cancelled before it could persist stale values.
    expect(mocks.upsertMatchPrediction).not.toHaveBeenCalled()
  })

  it('surfaces a stale delete as the existing optimistic-concurrency conflict', async () => {
    mocks.fetchMatchPredictions.mockResolvedValue([
      {
        matchId: 'match-1',
        homeScore: 3,
        awayScore: 2,
        joker: false,
        version: 4,
      },
    ])
    mocks.deleteMatchPrediction.mockRejectedValue({ code: 'PT409' })

    const api = await renderReadyProvider()

    act(() => {
      api.setScore('match-1', 'home', null)
    })

    await waitFor(() => {
      expect(mocks.deleteMatchPrediction).toHaveBeenCalledWith(
        'entry-1',
        'match-1',
        4,
      )
      expect(currentApi?.getSaveStatus('match-1')).toBe('conflict')
      expect(currentApi?.hasConflict).toBe(true)
    })

    // A version conflict is terminal; no automatic retry may delete newer work.
    expect(mocks.deleteMatchPrediction).toHaveBeenCalledTimes(1)
  })
})
