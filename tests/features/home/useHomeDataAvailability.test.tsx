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
  fetchLeagueMembersPage: vi.fn(),
  fetchLastSeenRead: vi.fn(),
  updateLastSeen: vi.fn(),
}))

// Context providers retain their value object while a child updates its own
// state. Keep the test doubles equally stable; returning a fresh object from
// either mocked hook on every Harness render would retrigger useHomeData's
// effect indefinitely and would not model the real providers.
const context = vi.hoisted(() => ({
  tournamentData: {
    status: 'ready' as const,
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
  },
  predictions: {
    ready: true,
    submittedAt: '2026-07-24T12:00:00.000Z',
    getPrediction: vi.fn(() => ({ homeScore: 1, awayScore: 0, joker: false })),
    jokerCount: 0,
    tieResolutions: [],
    bracketProgression: {},
  },
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1', displayName: 'Dashboard Tester' }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => context.tournamentData,
}))

vi.mock('../../../src/app/providers/PredictionsProvider', () => ({
  usePredictions: () => context.predictions,
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
  fetchLeagueMembersPage: mocks.fetchLeagueMembersPage,
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

function privateLeaguePage(totalPoints = 10, rank = 1) {
  return {
    rows: [
      {
        userId: 'leader',
        displayName: 'League leader',
        totalPoints,
        rank,
        tied: false,
        position: 1,
        isYou: false,
        isOwner: false,
        hasEntry: true,
        predictedCount: 36,
        joinedAt: '2026-07-20T12:00:00.000Z',
      },
    ],
    totalCount: 2,
    pageSize: 1,
    hasMore: true,
    nextCursor: 'league-cursor',
    you: {
      userId: 'user-1',
      displayName: 'Dashboard Tester',
      totalPoints,
      rank,
      tied: false,
      position: 1,
      isOwner: false,
      hasEntry: true,
      predictedCount: 36,
      joinedAt: '2026-07-18T12:00:00.000Z',
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
    mocks.fetchLeagueMembersPage.mockResolvedValue(privateLeaguePage())
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

  it('uses the lightweight summary activity field to break equal-rank leagues', async () => {
    mocks.fetchMyLeagues.mockResolvedValueOnce([
      {
        id: 'league-older',
        name: 'Older league',
        inviteCode: 'OLDER1',
        memberCount: 2,
        isOwner: false,
        ownerName: 'Owner',
        lastActivityAt: '2026-07-20T12:00:00.000Z',
      },
      {
        id: 'league-newer',
        name: 'Newer league',
        inviteCode: 'NEWER1',
        memberCount: 2,
        isOwner: false,
        ownerName: 'Owner',
        lastActivityAt: '2026-07-25T12:00:00.000Z',
      },
    ])
    mocks.fetchLeagueMembersPage.mockResolvedValue(privateLeaguePage(10, 1))

    const model = await renderModel()

    expect(model.bestLeague?.id).toBe('league-newer')
    expect(mocks.fetchLeagueMembersPage).toHaveBeenCalledTimes(2)
    expect(mocks.fetchLeagueMembersPage).toHaveBeenCalledWith('league-older', { limit: 1 })
    expect(mocks.fetchLeagueMembersPage).toHaveBeenCalledWith('league-newer', { limit: 1 })
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
