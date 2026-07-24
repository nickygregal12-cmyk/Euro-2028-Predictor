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

function deferredNumber() {
  let resolve!: (value: number) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<number>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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

describe('PredictionsProvider submission save barrier', () => {
  beforeEach(() => {
    currentApi = null
    vi.clearAllMocks()
    mocks.getOrCreateEntry.mockResolvedValue({ id: 'entry-1', submittedAt: null })
    mocks.fetchMatchPredictions.mockResolvedValue([])
    mocks.fetchGoldenBoot.mockResolvedValue({ playerId: null, version: 0 })
    mocks.fetchTieResolutions.mockResolvedValue([])
    mocks.fetchProgression.mockResolvedValue([])
    mocks.upsertGoldenBoot.mockResolvedValue(1)
    mocks.upsertTieResolution.mockResolvedValue(undefined)
    mocks.upsertProgression.mockResolvedValue(1)
    mocks.deleteProgression.mockResolvedValue(undefined)
    mocks.deleteMatchPrediction.mockResolvedValue(false)
    mocks.submitEntry.mockResolvedValue('2026-07-24T00:00:00.000Z')
  })

  afterEach(() => {
    currentApi = null
  })

  it('flushes the last debounced score and waits for it before submit_entry', async () => {
    const save = deferredNumber()
    const order: string[] = []
    mocks.upsertMatchPrediction.mockImplementation(() => {
      order.push('save-started')
      return save.promise.then((version) => {
        order.push('save-finished')
        return version
      })
    })
    mocks.submitEntry.mockImplementation(async () => {
      order.push('submitted')
      return '2026-07-24T00:00:00.000Z'
    })

    const api = await renderReadyProvider()

    act(() => {
      api.setScore('match-1', 'home', 2)
      api.setScore('match-1', 'away', 1)
    })

    let submission!: Promise<{ ok: boolean; message?: string }>
    act(() => {
      submission = api.submit()
    })

    expect(mocks.upsertMatchPrediction).toHaveBeenCalledWith(
      'entry-1',
      'match-1',
      2,
      1,
      false,
      0,
    )
    expect(order).toEqual(['save-started'])
    expect(mocks.submitEntry).not.toHaveBeenCalled()

    let result!: { ok: boolean; message?: string }
    await act(async () => {
      save.resolve(1)
      result = await submission
    })

    expect(result).toEqual({ ok: true })
    expect(order).toEqual(['save-started', 'save-finished', 'submitted'])
    expect(mocks.submitEntry).toHaveBeenCalledWith('entry-1')
  })

  it('flushes the last debounced bracket snapshot before submit_entry', async () => {
    const save = deferredNumber()
    const order: string[] = []
    mocks.upsertProgression.mockImplementation(() => {
      order.push('bracket-save-started')
      return save.promise.then((version) => {
        order.push('bracket-save-finished')
        return version
      })
    })
    mocks.submitEntry.mockImplementation(async () => {
      order.push('submitted')
      return '2026-07-24T00:00:00.000Z'
    })

    const api = await renderReadyProvider()

    act(() => {
      api.setBracketProgression({ 'team-1': 'qf' })
    })

    let submission!: Promise<{ ok: boolean; message?: string }>
    act(() => {
      submission = api.submit()
    })

    expect(mocks.upsertProgression).toHaveBeenCalledWith(
      'entry-1',
      'team-1',
      'qf',
      0,
    )
    expect(order).toEqual(['bracket-save-started'])
    expect(mocks.submitEntry).not.toHaveBeenCalled()

    let result!: { ok: boolean; message?: string }
    await act(async () => {
      save.resolve(1)
      result = await submission
    })

    expect(result).toEqual({ ok: true })
    expect(order).toEqual(['bracket-save-started', 'bracket-save-finished', 'submitted'])
    expect(mocks.submitEntry).toHaveBeenCalledWith('entry-1')
  })

  it('does not call submit_entry when the flushed save reaches a terminal error', async () => {
    mocks.upsertMatchPrediction.mockRejectedValue(new Error('offline'))
    const api = await renderReadyProvider()

    act(() => {
      api.setScore('match-1', 'home', 1)
      api.setScore('match-1', 'away', 0)
    })

    let submission!: Promise<{ ok: boolean; message?: string }>
    act(() => {
      submission = api.submit()
    })

    await act(async () => {
      await vi.waitFor(() => expect(mocks.upsertMatchPrediction).toHaveBeenCalledTimes(3), {
        timeout: 4000,
      })
    })

    const result = await submission
    expect(result).toEqual({
      ok: false,
      message: 'Some changes could not be saved. Retry the failed changes before submitting.',
    })
    expect(mocks.submitEntry).not.toHaveBeenCalled()
  })
})
