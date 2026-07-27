import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useHomeData,
  type HomeModel,
  type HomeState,
} from '../../../src/features/home/useHomeData'

const mocks = vi.hoisted(() => ({
  fetchLeaderboardPage: vi.fn(),
  fetchMyScoreEventPoints: vi.fn(),
  fetchMyLeagues: vi.fn(),
  fetchLeagueMembers: vi.fn(),
  fetchLastSeenRead: vi.fn(),
  updateLastSeen: vi.fn(),
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1', displayName: 'Dashboard Tester' }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: {
        id: 'tournament-1',
        lockAt: null,
        startsOn: '2028-06-09',
      },
      teams: [],
      groups: [],
      matches: [
        {
          id: 'match-1',
          matchRef: 'M01',
          groupId: null,
          matchday: 1,
          homeTeamId: null,
          awayTeamId: null,
          kickoffAt: '2026-07-25T12:00:00.000Z',
          matchDate: '2026-07-25',
          homeScore: 1,
          awayScore: 0,
        },
      ],
    },
  }),
}))

vi.mock('../../../src/app/providers/PredictionsProvider', () => ({
  usePredictions: () => ({
    ready: true,
    submittedAt: '2026-07-24T12:00:00.000Z',
    getPrediction: () => ({ homeScore: 1, awayScore: 0, joker: false }),
    jokerCount: 0,
    tieResolutions: [],
    bracketProgression: {},
  }),
}))

vi.mock('../../../src/features/predict/hubStatus', () => ({
  computeHubStatus: () => ({
    overallPercent: 100,
    groups: { predicted: 36, total: 36 },
  }),
}))

vi.mock('../../../src/features/bracket', () => ({
  buildBracketPipeline: () => ({ champion: null }),
}))

vi.mock('../../../src/app/time', () => ({
  todayISO: () => '2026-07-25',
}))

vi.mock('../../../src/services/supabase/leaderboard', () => ({
  fetchLeaderboardPage: mocks.fetchLeaderboardPage,
}))

vi.mock('../../../src/services/supabase/scoring', () => ({
  fetchMyScoreEventPoints: mocks.fetchMyScoreEventPoints,
}))

vi.mock('../../../src/services/supabase/leagues', () => ({
  fetchMyLeagues: mocks.fetchMyLeagues,
  fetchLeagueMembers: mocks.fetchLeagueMembers,
}))

vi.mock('../../../src/services/supabase/profile', () => ({
  fetchLastSeenRead: mocks.fetchLastSeenRead,
  updateLastSeen: mocks.updateLastSeen,
}))

let currentState: HomeState | null = null

function Harness() {
  currentState = useHomeData()
  return null
}

async function renderModel(): Promise<HomeModel> {
  render(<Harness />)
  await waitFor(() => expect(currentState?.status).toBe('ready'))
  if (!currentState || currentState.status !== 'ready') {
    throw new Error('Home data did not become ready')
  }
  return currentState.model
}

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

describe('useHomeData source availability', () => {
  beforeEach(() => {
    currentState = null
    vi.clearAllMocks()
    mocks.fetchLeaderboardPage.mockResolvedValue(leaderboardPage())
    mocks.fetchMyScoreEventPoints.mockResolvedValue([
      { matchId: 'match-1', points: 5 },
    ])
    mocks.fetchMyLeagues.mockResolvedValue([])
    mocks.fetchLeagueMembers.mockResolvedValue([])
    mocks.fetchLastSeenRead.mockResolvedValue({
      available: true,
      value: { lastSeenAt: null, lastSeenPoints: null },
    })
    mocks.updateLastSeen.mockResolvedValue(undefined)
  })

  it('preserves successful sources when the leaderboard is unavailable', async () => {
    mocks.fetchLeaderboardPage.mockRejectedValueOnce(new Error('leaderboard offline'))

    const model = await renderModel()

    expect(model.totalPoints).toBeNull()
    expect(model.entryCount).toBeNull()
    expect(model.rank).toBeNull()
    expect(model.pointsToday).toBe(5)
    expect(model.hasAnyLeague).toBe(false)
    expect(model.unavailable).toEqual(
      expect.arrayContaining(['leaderboard', 'catchUp']),
    )
    expect(model.unavailable).not.toContain('scoreEvents')
    expect(model.unavailable).not.toContain('leagues')
    expect(mocks.fetchLastSeenRead).not.toHaveBeenCalled()
    expect(mocks.updateLastSeen).not.toHaveBeenCalled()
  })

  it('keeps a successful empty league read distinct from an unavailable read', async () => {
    const model = await renderModel()

    expect(model.hasAnyLeague).toBe(false)
    expect(model.bestLeague).toBeNull()
    expect(model.unavailable).not.toContain('leagues')
  })

  it('marks league state unavailable when the league list read fails', async () => {
    mocks.fetchMyLeagues.mockRejectedValueOnce(new Error('league list offline'))

    const model = await renderModel()

    expect(model.hasAnyLeague).toBeNull()
    expect(model.bestLeague).toBeNull()
    expect(model.unavailable).toContain('leagues')
    expect(model.totalPoints).toBe(12)
    expect(model.pointsToday).toBe(5)
  })

  it('does not overwrite the catch-up snapshot after an unavailable read', async () => {
    mocks.fetchLastSeenRead.mockResolvedValueOnce({ available: false, value: null })

    const model = await renderModel()

    expect(model.totalPoints).toBe(12)
    expect(model.catchUp).toBeNull()
    expect(model.unavailable).toContain('catchUp')
    expect(mocks.updateLastSeen).not.toHaveBeenCalled()
  })
})
