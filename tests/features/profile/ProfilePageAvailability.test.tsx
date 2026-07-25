import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from '../../../src/features/profile/ProfilePage'

const mocks = vi.hoisted(() => ({
  fetchLeaderboard: vi.fn(),
  fetchMyLeagues: vi.fn(),
  fetchMyScoreEvents: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ displayName: 'Profile Tester' }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: {
        id: 'tournament-1',
        lockAt: null,
      },
      teams: [],
      groups: [],
      matches: [],
    },
  }),
}))

vi.mock('../../../src/app/providers/PredictionsProvider', () => ({
  usePredictions: () => ({
    ready: true,
    getPrediction: () => ({ homeScore: null, awayScore: null, joker: false }),
    tieResolutions: [],
    bracketProgression: {},
  }),
}))

vi.mock('../../../src/features/bracket', () => ({
  buildBracketPipeline: () => ({ champion: null }),
}))

vi.mock('../../../src/services/supabase/leaderboard', () => ({
  fetchLeaderboard: mocks.fetchLeaderboard,
}))

vi.mock('../../../src/services/supabase/leagues', () => ({
  fetchMyLeagues: mocks.fetchMyLeagues,
}))

vi.mock('../../../src/services/supabase/scoring', () => ({
  fetchMyScoreEvents: mocks.fetchMyScoreEvents,
}))

function renderPage() {
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  )
}

describe('ProfilePage source availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchLeaderboard.mockResolvedValue([
      { displayName: 'Profile Tester', totalPoints: 0, isYou: true },
    ])
    mocks.fetchMyLeagues.mockResolvedValue([])
    mocks.fetchMyScoreEvents.mockResolvedValue([])
  })

  it('keeps successful zero and empty reads as genuine values', async () => {
    renderPage()

    expect(await screen.findByText('0 leagues')).toBeVisible()
    expect(screen.getByText('Points')).toBeVisible()
    expect(screen.queryByText('Points unavailable')).not.toBeInTheDocument()
    expect(screen.getByText('Group matches')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('marks leaderboard figures unavailable while preserving successful profile sources', async () => {
    mocks.fetchLeaderboard.mockRejectedValueOnce(new Error('leaderboard offline'))
    mocks.fetchMyScoreEvents.mockResolvedValueOnce([
      {
        id: 'event-1',
        category: 'group_matches',
        explanation: 'Scotland 2–1 England · exact score',
        points: 5,
      },
    ])

    renderPage()

    expect(await screen.findByText('Points unavailable')).toBeVisible()
    expect(screen.getByText('Rank unavailable')).toBeVisible()
    expect(screen.getByText('0 leagues')).toBeVisible()
    expect(screen.getByText('Scotland 2–1 England · exact score')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Some profile data is unavailable')
  })

  it('keeps an unavailable league source distinct from a successful empty account', async () => {
    mocks.fetchMyLeagues.mockRejectedValueOnce(new Error('league list offline'))

    renderPage()

    expect(await screen.findByText('Leagues unavailable')).toBeVisible()
    expect(screen.queryByText('0 leagues')).not.toBeInTheDocument()
    expect(screen.getByText('Points')).toBeVisible()
    expect(screen.getByText('Group matches')).toBeVisible()
  })

  it('does not render an unavailable score-event source as an empty zero breakdown', async () => {
    mocks.fetchMyScoreEvents.mockRejectedValueOnce(new Error('score events offline'))

    renderPage()

    expect(await screen.findByText(/Points breakdown unavailable/)).toBeVisible()
    expect(screen.queryByText('Group matches')).not.toBeInTheDocument()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
    expect(screen.getByText('Points')).toBeVisible()
    expect(screen.getByText('0 leagues')).toBeVisible()
  })
})
