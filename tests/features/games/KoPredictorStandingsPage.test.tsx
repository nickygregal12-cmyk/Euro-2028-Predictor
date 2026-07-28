import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KoPredictorStandingsPage } from '../../../src/features/games/KoPredictorStandingsPage'
import type { KoStandingsRead } from '../../../src/services/supabase/koPredictorStandingsModel'

const mocks = vi.hoisted(() => ({
  fetchKoPredictorStandings: vi.fn<() => Promise<KoStandingsRead>>(),
}))

vi.mock('../../../src/services/supabase/koPredictorStandings', () => ({
  fetchKoPredictorStandings: mocks.fetchKoPredictorStandings,
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: { tournament: { id: 'tournament-1' } },
  }),
}))

function row(userId: string, name: string, rank: number, points: number) {
  return {
    userId,
    displayName: name,
    rank,
    totalPoints: points,
    exactCount: 0,
    resultCount: 0,
    throughCount: 0,
    matchesScored: 0,
  }
}

function read(overrides: Partial<KoStandingsRead> = {}): KoStandingsRead {
  return {
    serverNow: '2028-06-30T12:00:00Z',
    competitionId: 'comp-ko',
    standings: [],
    me: null,
    nextCursor: null,
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <KoPredictorStandingsPage />
    </MemoryRouter>,
  )
}

describe('KoPredictorStandingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the empty state before anyone enters', async () => {
    mocks.fetchKoPredictorStandings.mockResolvedValue(read())
    renderPage()

    expect(await screen.findByText('No entrants yet')).toBeTruthy()
  })

  it('renders ranked rows, marks the caller and shows their context', async () => {
    mocks.fetchKoPredictorStandings.mockResolvedValue(
      read({
        standings: [row('user-1', 'Alpha', 1, 7), row('user-2', 'Duo', 2, 2)],
        me: {
          rank: 1,
          totalPoints: 7,
          exactCount: 1,
          resultCount: 0,
          throughCount: 1,
          matchesScored: 1,
        },
      }),
    )
    renderPage()

    expect(await screen.findByText('Alpha (you)')).toBeTruthy()
    expect(screen.getByText('Duo')).toBeTruthy()
    expect(screen.getByText('Your position')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('walks the cursor through Load more', async () => {
    mocks.fetchKoPredictorStandings
      .mockResolvedValueOnce(
        read({ standings: [row('user-1', 'Alpha', 1, 7)], nextCursor: '7:user-1' }),
      )
      .mockResolvedValueOnce(read({ standings: [row('user-2', 'Duo', 2, 2)] }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Duo')).toBeTruthy()
    expect(screen.getByText('Alpha (you)')).toBeTruthy()
    await waitFor(() => {
      expect(mocks.fetchKoPredictorStandings).toHaveBeenLastCalledWith(
        'tournament-1',
        '7:user-1',
      )
    })
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('recovers from a load failure through retry', async () => {
    mocks.fetchKoPredictorStandings
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(read())
    renderPage()

    expect(await screen.findByText('Couldn’t load the standings')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('No entrants yet')).toBeTruthy()
  })
})
