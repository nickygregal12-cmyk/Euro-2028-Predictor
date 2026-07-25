import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGoldenBootPlayerSearch } from '../../../src/features/predict/useGoldenBootPlayerSearch'

const mocks = vi.hoisted(() => ({
  searchPlayers: vi.fn(),
}))

vi.mock('../../../src/services/supabase/bonus', () => ({
  searchPlayers: mocks.searchPlayers,
}))

async function runDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(300)
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useGoldenBootPlayerSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a successful empty search distinct from an unavailable search', async () => {
    mocks.searchPlayers.mockResolvedValueOnce([])

    const { result } = renderHook(() =>
      useGoldenBootPlayerSearch('tournament-1', 'unknown player'),
    )

    expect(result.current.status).toBe('loading')
    await runDebounce()

    expect(result.current.status).toBe('ready')
    expect(result.current.results).toEqual([])
    expect(result.current.message).toBeNull()
  })

  it('maps a rejected player search to an explicit unavailable state', async () => {
    mocks.searchPlayers.mockRejectedValueOnce(new Error('relation public.players does not exist'))

    const { result } = renderHook(() =>
      useGoldenBootPlayerSearch('tournament-1', 'Mbappé'),
    )

    await runDebounce()

    expect(result.current.status).toBe('unavailable')
    expect(result.current.results).toEqual([])
    expect(result.current.message).toBe('Could not search players. Please try again.')
    expect(result.current.message).not.toContain('public.players')
  })

  it('retries the same query and replaces unavailable state with recovered results', async () => {
    mocks.searchPlayers
      .mockRejectedValueOnce(new Error('search offline'))
      .mockResolvedValueOnce([{ id: 'player-1', name: 'Kylian Mbappé' }])

    const { result } = renderHook(() =>
      useGoldenBootPlayerSearch('tournament-1', 'Mbappé'),
    )

    await runDebounce()
    expect(result.current.status).toBe('unavailable')

    act(() => result.current.retry())
    expect(result.current.status).toBe('loading')
    await runDebounce()

    expect(mocks.searchPlayers).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
    expect(result.current.results).toEqual([{ id: 'player-1', name: 'Kylian Mbappé' }])
  })
})
