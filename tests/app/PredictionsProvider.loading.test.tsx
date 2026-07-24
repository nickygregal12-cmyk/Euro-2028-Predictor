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

let currentApi: PredictionsApi | null = null

function Harness() {
  currentApi = usePredictions()
  return null
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderProvider() {
  render(
    <PredictionsProvider>
      <Harness />
    </PredictionsProvider>,
  )
}

async function renderReadyProvider() {
  renderProvider()
  await waitFor(() => expect(currentApi?.ready).toBe(true))
  if (!currentApi) throw new Error('Predictions context did not mount')
  return currentApi
}

describe('PredictionsProvider late-read protection', () => {
  beforeEach(() => {
    currentApi = null
    vi.clearAllMocks()
    mocks.getOrCreateEntry.mockResolvedValue({ id: 'entry-1', submittedAt: null })
    mocks.fetchMatchPredictions.mockResolvedValue([])
    mocks.fetchGoldenBoot.mockResolvedValue({ playerId: null, version: 0 })
    mocks.fetchTieResolutions.mockResolvedValue([])
    mocks.fetchProgression.mockResolvedValue([])
    mocks.upsertMatchPrediction.mockResolvedValue(1)
    mocks.deleteMatchPrediction.mockResolvedValue(false)
    mocks.submitEntry.mockResolvedValue('2026-07-24T00:00:00.000Z')
    mocks.upsertGoldenBoot.mockResolvedValue(1)
    mocks.upsertTieResolution.mockResolvedValue(undefined)
    mocks.upsertProgression.mockResolvedValue(1)
    mocks.deleteProgression.mockResolvedValue(undefined)
  })

  afterEach(() => {
    currentApi = null
  })

  it('does not let the initial match read replace a newer local score', async () => {
    const matchRead = deferred<
      Array<{
        matchId: string
        homeScore: number
        awayScore: number
        joker: boolean
        version: number
      }>
    >()
    mocks.fetchMatchPredictions.mockReturnValue(matchRead.promise)

    renderProvider()
    await waitFor(() =>
      expect(mocks.fetchMatchPredictions).toHaveBeenCalledWith('entry-1'),
    )
    if (!currentApi) throw new Error('Predictions context did not mount')

    act(() => {
      currentApi?.setScore('match-1', 'home', 2)
      currentApi?.setScore('match-1', 'away', 1)
    })

    await act(async () => {
      matchRead.resolve([
        {
          matchId: 'match-1',
          homeScore: 0,
          awayScore: 0,
          joker: false,
          version: 4,
        },
      ])
      await matchRead.promise
    })

    await waitFor(() => expect(currentApi?.ready).toBe(true))
    expect(currentApi?.getPrediction('match-1')).toEqual({
      homeScore: 2,
      awayScore: 1,
      joker: false,
    })
  })

  it('does not let a late tie read replace a newer manual order', async () => {
    const tieRead = deferred<
      Array<{
        scope: 'group' | 'third'
        teamIds: string[]
        order: string[]
      }>
    >()
    mocks.fetchTieResolutions.mockReturnValue(tieRead.promise)

    const api = await renderReadyProvider()
    act(() => {
      api.setTieResolution('group', ['team-b', 'team-a'])
    })

    await act(async () => {
      tieRead.resolve([
        {
          scope: 'group',
          teamIds: ['team-a', 'team-b'],
          order: ['team-a', 'team-b'],
        },
      ])
      await tieRead.promise
    })

    expect(currentApi?.tieResolutions).toEqual([
      {
        teamIds: ['team-b', 'team-a'],
        order: ['team-b', 'team-a'],
      },
    ])
  })

  it('does not let a late progression read replace a newer bracket snapshot', async () => {
    const progressionRead = deferred<
      Array<{
        teamId: string
        stage: 'r16' | 'qf' | 'sf' | 'final' | 'champion'
        version: number
      }>
    >()
    mocks.fetchProgression.mockReturnValue(progressionRead.promise)

    const api = await renderReadyProvider()
    act(() => {
      api.setBracketProgression({ 'team-local': 'qf' })
    })

    await act(async () => {
      progressionRead.resolve([
        { teamId: 'team-server', stage: 'sf', version: 6 },
      ])
      await progressionRead.promise
    })

    expect(currentApi?.bracketProgression).toEqual({ 'team-local': 'qf' })
  })

  it('does not let a late Golden Boot failure clear a newer local pick', async () => {
    const goldenBootRead = deferred<{
      playerId: string | null
      version: number
    }>()
    mocks.fetchGoldenBoot.mockReturnValue(goldenBootRead.promise)

    const api = await renderReadyProvider()
    act(() => {
      api.setGoldenBoot('player-local')
    })

    await act(async () => {
      goldenBootRead.reject(new Error('offline'))
      await goldenBootRead.promise.catch(() => undefined)
    })

    expect(currentApi?.goldenBootPlayerId).toBe('player-local')
  })
})
