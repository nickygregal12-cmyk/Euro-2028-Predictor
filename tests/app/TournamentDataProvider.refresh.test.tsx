import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TournamentDataProvider,
  useTournamentData,
} from '../../src/app/providers/TournamentDataProvider'

const mocks = vi.hoisted(() => ({
  fetchTournamentData: vi.fn(),
}))

vi.mock('../../src/services/supabase/tournamentData', () => ({
  fetchTournamentData: mocks.fetchTournamentData,
}))

vi.mock('../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}))

type TournamentContext = ReturnType<typeof useTournamentData>
let current: TournamentContext | null = null

function Harness() {
  current = useTournamentData()
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

function tournamentData(name: string) {
  return {
    tournament: { id: 'tournament-1', name },
    teams: [],
    matches: [],
    players: [],
  }
}

describe('TournamentDataProvider foreground refresh', () => {
  beforeEach(() => {
    current = null
    vi.clearAllMocks()
    setVisibility('visible')
  })

  afterEach(() => {
    setVisibility('visible')
  })

  it('keeps ready data visible while replacing it after a foreground return', async () => {
    const refresh = deferred<ReturnType<typeof tournamentData>>()
    mocks.fetchTournamentData
      .mockResolvedValueOnce(tournamentData('Initial'))
      .mockReturnValueOnce(refresh.promise)

    render(
      <TournamentDataProvider>
        <Harness />
      </TournamentDataProvider>,
    )

    await waitFor(() => expect(current?.status).toBe('ready'))
    if (current?.status !== 'ready') throw new Error('Tournament data did not load')
    expect(current.data.tournament.name).toBe('Initial')

    act(() => {
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(mocks.fetchTournamentData).toHaveBeenCalledTimes(2))
    expect(current?.status).toBe('ready')
    if (current?.status !== 'ready') throw new Error('Refresh introduced a loading flash')
    expect(current.data.tournament.name).toBe('Initial')

    await act(async () => {
      refresh.resolve(tournamentData('Refreshed'))
      await refresh.promise
    })

    await waitFor(() => {
      if (current?.status !== 'ready') throw new Error('Tournament data is not ready')
      expect(current.data.tournament.name).toBe('Refreshed')
    })
  })

  it('preserves valid ready data when a background refresh fails', async () => {
    mocks.fetchTournamentData
      .mockResolvedValueOnce(tournamentData('Initial'))
      .mockRejectedValueOnce(new Error('offline'))

    render(
      <TournamentDataProvider>
        <Harness />
      </TournamentDataProvider>,
    )
    await waitFor(() => expect(current?.status).toBe('ready'))

    act(() => {
      setVisibility('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      setVisibility('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(mocks.fetchTournamentData).toHaveBeenCalledTimes(2))
    expect(current?.status).toBe('ready')
    if (current?.status !== 'ready') throw new Error('Ready data was discarded')
    expect(current.data.tournament.name).toBe('Initial')
  })
})
