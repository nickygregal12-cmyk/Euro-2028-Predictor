import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from '../../../src/features/profile/ProfilePage'

const mocks = vi.hoisted(() => ({
  fetchLeaderboardPage: vi.fn(),
  fetchMyLeagues: vi.fn(),
  fetchMyScoreEvents: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1', displayName: 'Profile Tester' }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: {
        id: 'tournament-1',
        lockAt: null,
      },
      matches: [
        {
          id: 'match-1',
          round: 'group',
          homeScore: 2,
          awayScore: 1,
        },
      ],
    },
  }),
}))

vi.mock('../../../src/app/providers/PredictionsProvider', () => ({
  usePredictions: () => ({
    ready: true,
    getPrediction: () => ({ homeScore: 2, awayScore: 1, joker: false }),
    tieResolutions: [],
    bracketProgression: {},
  }),
}))

vi.mock('../../../src/features/bracket', () => ({
  buildBracketPipeline: () => ({ champion: null }),
}))

vi.mock('../../../src/services/supabase/leaderboard', () => ({
  fetchLeaderboardPage: mocks.fetchLeaderboardPage,
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

async function waitForProfile() {
  await waitFor(() => expect(screen.getByText('Profile Tester')).toBeVisible())
}

function leaderboardPage() {
  return {
    rows: [
      {
        displayName: 'Profile Tester',
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
      displayName: 'Profile Tester',
      totalPoints: 12,
      rank: 1,
      tied: false,
      position: 1,
    },
  }
}

describe('ProfilePage remote source availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchLeaderboardPage.mockResolvedValue(leaderboardPage())
    mocks.fetchMyLeagues.mockResolvedValue([])
    mocks.fetchMyScoreEvents.mockResolvedValue([
      {
        id: 'event-1',
        category: 'group_matches',
        explanation: 'Scotland 2–1 England · exact score',
        points: 5,
      },
    ])
  })

  it('preserves locally derived accuracy when the leaderboard is unavailable', async () => {
    mocks.fetchLeaderboardPage.mockRejectedValueOnce(new Error('leaderboard offline'))

    renderPage()
    await waitForProfile()

    expect(screen.getByRole('alert')).toHaveTextContent('Some profile data is unavailable')
    expect(screen.getByText('Points unavailable')).toBeVisible()
    expect(screen.getByText('Rank unavailable')).toBeVisible()
    expect(screen.getByText('100%')).toBeVisible()
    expect(screen.getByText('0 leagues')).toBeVisible()
    expect(screen.getByText('Group matches')).toBeVisible()
  })

  it('keeps a successful empty league list distinct from an unavailable read', async () => {
    renderPage()
    await waitForProfile()

    expect(screen.getByText('0 leagues')).toBeVisible()
    expect(screen.queryByText('Leagues unavailable')).not.toBeInTheDocument()
    expect(screen.queryByText('Some profile data is unavailable')).not.toBeInTheDocument()
  })

  it('marks the league count unavailable without hiding successful points data', async () => {
    mocks.fetchMyLeagues.mockRejectedValueOnce(new Error('leagues offline'))

    renderPage()
    await waitForProfile()

    expect(screen.getByText('Leagues unavailable')).toBeVisible()
    expect(screen.queryByText('0 leagues')).not.toBeInTheDocument()
    expect(screen.getByText('12')).toBeVisible()
    expect(screen.getByText('1st')).toBeVisible()
    expect(screen.getByText('Group matches')).toBeVisible()
  })

  it('does not render an empty points history when score events are unavailable', async () => {
    mocks.fetchMyScoreEvents.mockRejectedValueOnce(new Error('events offline'))

    renderPage()
    await waitForProfile()

    expect(screen.getByText('Points breakdown unavailable')).toBeVisible()
    expect(screen.queryByText('Group matches')).not.toBeInTheDocument()
    expect(screen.getByText('12')).toBeVisible()
    expect(screen.getByText('0 leagues')).toBeVisible()
  })
})
