import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeaguePage } from '../../../src/features/league/LeaguePage'

const mocks = vi.hoisted(() => ({
  fetchLeaderboardPage: vi.fn(),
  fetchMyLeagues: vi.fn(),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: { id: 'tournament-1' },
    },
  }),
}))

vi.mock('../../../src/services/supabase/leaderboard', () => ({
  fetchLeaderboardPage: mocks.fetchLeaderboardPage,
}))

vi.mock('../../../src/services/supabase/leagues', () => ({
  fetchMyLeagues: mocks.fetchMyLeagues,
}))

vi.mock('../../../src/features/leagues/CreateLeagueModal', () => ({
  CreateLeagueModal: () => null,
}))

vi.mock('../../../src/features/leagues/JoinLeagueModal', () => ({
  JoinLeagueModal: () => null,
}))

function leaderboardPage() {
  return {
    rows: [
      {
        displayName: 'Dashboard Tester',
        totalPoints: 12,
        rank: 1,
        tied: false,
        position: 1,
        isYou: true,
      },
    ],
    totalCount: 2,
    pageSize: 1,
    hasMore: true,
    nextCursor: 'cursor',
    you: {
      displayName: 'Dashboard Tester',
      totalPoints: 12,
      rank: 1,
      tied: false,
      position: 1,
    },
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <LeaguePage />
    </MemoryRouter>,
  )
}

describe('LeaguePage data availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchLeaderboardPage.mockResolvedValue(leaderboardPage())
    mocks.fetchMyLeagues.mockResolvedValue([])
  })

  it('renders a genuine empty account only after a successful league read', async () => {
    renderPage()

    expect(await screen.findByText('No leagues yet')).toBeVisible()
    expect(screen.queryByText("Couldn't load your leagues")).not.toBeInTheDocument()
    expect(mocks.fetchMyLeagues).toHaveBeenCalledWith('tournament-1')
    expect(mocks.fetchLeaderboardPage).toHaveBeenCalledWith('tournament-1', { limit: 1 })
  })

  it('keeps the standings summary visible when the league list is unavailable', async () => {
    mocks.fetchMyLeagues.mockRejectedValueOnce(new Error('league list offline'))

    renderPage()

    expect(await screen.findByText("Couldn't load your leagues")).toBeVisible()
    expect(screen.getByText('All players, everywhere')).toBeVisible()
    expect(screen.queryByText('No leagues yet')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create league/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Join league' })).toBeVisible()
  })

  it('retries only the unavailable league source and renders recovered rows', async () => {
    mocks.fetchMyLeagues
      .mockRejectedValueOnce(new Error('league list offline'))
      .mockResolvedValueOnce([
        {
          id: 'league-1',
          name: 'Weekend League',
          inviteCode: 'ABC123',
          memberCount: 4,
          isOwner: true,
          ownerName: 'Dashboard Tester',
        },
      ])

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Retry leagues' }))

    expect(await screen.findByText('Weekend League')).toBeVisible()
    expect(mocks.fetchMyLeagues).toHaveBeenCalledTimes(2)
    expect(mocks.fetchLeaderboardPage).toHaveBeenCalledTimes(1)
  })

  it('retains the existing hard error when overall standings are unavailable', async () => {
    mocks.fetchLeaderboardPage.mockRejectedValueOnce(new Error('standings offline'))

    renderPage()

    expect(await screen.findByText("Couldn't load standings")).toBeVisible()
    expect(screen.queryByText('No leagues yet')).not.toBeInTheDocument()
    await waitFor(() => expect(mocks.fetchLeaderboardPage).toHaveBeenCalledTimes(1))
  })
})
