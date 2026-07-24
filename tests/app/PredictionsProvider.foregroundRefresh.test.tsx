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
  isVersionConflict: () => false,
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
let current: PredictionsApi | null = null

function Harness() {
  current = usePredictions()
  return null
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function row(homeScore: number, awayScore: number, version: number) {
  return {
    matchId: 'match-1',
    homeScore,
    awayScore,
    joker: false,
    version,
  }
}

async function renderReady() {
  render(
    <PredictionsProvider>
      <Harness />
    </PredictionsProvider>,
  )
  await waitFor(() => expect(current?.ready).toBe(true))
  if (!current) throw new Error('Predictions context did not mount')
  return current
}

function returnToForeground() {
  act(() => {
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
  })
}

describe('PredictionsProvider foreground refresh', () => {
  beforeEach(() => {
    current = null
    vi.clearAllMocks()
    setVisibility('visible')
    mocks.getOrCreateEntry.mockResolvedValue({ id: 'entry-1', submittedAt: null })
    mocks.fetchMatchPredictions.mockResolvedValue([row(0, 0, 1)])
    mocks.fetchTieResolutions.mockResolvedValue([])
    mocks.fetchProgression.mockResolvedValue([])
    mocks.fetchGoldenBoot.mockResolvedValue({ playerId: null, version: 0 })
    mocks.upsertMatchPrediction.mockResolvedValue(2)
    mocks.deleteMatchPrediction.mockResolvedValue(false)
    mocks.submitEntry.mockResolvedValue('2026-07-24T00:00:00.000Z')
    mocks.upsertGoldenBoot.mockResolvedValue(1)
    mocks.upsertTieResolution.mockResolvedValue(undefined)
    mocks.upsertProgression.mockResolvedValue(1)
    mocks.deleteProgression.mockResolvedValue(undefined)
  })

  afterEach(() => {
    setVisibility('visible')
    current = null
  })

  it('loads a persisted change after the page returns from the background', async () => {
    mocks.fetchMatchPredictions
      .mockResolvedValueOnce([row(0, 0, 1)])
      .mockResolvedValueOnce([row(2, 1, 2)])

    const api = await renderReady()
    expect(api.getPrediction('match-1')).toMatchObject({ homeScore: 0, awayScore: 0 })

    returnToForeground()

    await waitFor(() => {
      expect(mocks.fetchMatchPredictions).toHaveBeenCalledTimes(2)
      expect(current?.getPrediction('match-1')).toMatchObject({
        homeScore: 2,
        awayScore: 1,
      })
    })
    expect(mocks.getOrCreateEntry).toHaveBeenCalledTimes(2)
  })

  it('waits for a pending local save before reading persisted state', async () => {
    const save = deferred<number>()
    mocks.upsertMatchPrediction.mockReturnValue(save.promise)
    mocks.fetchMatchPredictions
      .mockResolvedValueOnce([row(0, 0, 1)])
      .mockResolvedValueOnce([row(3, 1, 2)])

    const api = await renderReady()
    act(() => {
      api.setScore('match-1', 'home', 3)
      api.setScore('match-1', 'away', 1)
    })

    returnToForeground()

    await waitFor(() => expect(mocks.upsertMatchPrediction).toHaveBeenCalledOnce())
    expect(mocks.fetchMatchPredictions).toHaveBeenCalledOnce()

    await act(async () => {
      save.resolve(2)
      await save.promise
    })

    await waitFor(() => {
      expect(mocks.fetchMatchPredictions).toHaveBeenCalledTimes(2)
      expect(current?.getPrediction('match-1')).toMatchObject({
        homeScore: 3,
        awayScore: 1,
      })
    })
  })

  it('does not replace a local edit made while the refresh read is pending', async () => {
    const refresh = deferred<ReturnType<typeof row>[]>()
    mocks.fetchMatchPredictions
      .mockResolvedValueOnce([row(0, 0, 1)])
      .mockReturnValueOnce(refresh.promise)

    const api = await renderReady()
    returnToForeground()
    await waitFor(() => expect(mocks.fetchMatchPredictions).toHaveBeenCalledTimes(2))

    act(() => {
      api.setScore('match-1', 'home', 4)
      api.setScore('match-1', 'away', 2)
    })

    await act(async () => {
      refresh.resolve([row(1, 1, 2)])
      await refresh.promise
    })

    expect(current?.getPrediction('match-1')).toMatchObject({
      homeScore: 4,
      awayScore: 2,
    })
  })
})
