import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { H2HPage } from '../../../src/features/h2h/H2HPage'

const mocks = vi.hoisted(() => ({
  fetchRivalEntry: vi.fn(),
  fetchLeaderboardPage: vi.fn(),
  fetchH2HRankHistory: vi.fn(),
}))

function tournamentData(homeScore = 2, awayScore = 1) {
  return {
    status: 'ready' as const,
    data: {
      tournament: {
        id: 'tournament-1',
        lockAt: '2026-07-01T12:00:00.000Z',
      },
      teams: [
        { id: 'team-a', name: 'Scotland' },
        { id: 'team-b', name: 'England' },
      ],
      groups: [{ id: 'group-a' }],
      matches: [
        {
          id: 'match-1',
          round: 'group',
          groupId: 'group-a',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          homeScore,
          awayScore,
          resultState: 'confirmed',
        },
      ],
    },
  }
}

function predictionData(homeScore = 2, awayScore = 1) {
  return {
    ready: true,
    getPrediction: vi.fn(() => ({ homeScore, awayScore, joker: false })),
    bracketProgression: {
      'team-a': 'champion',
      'team-b': 'final',
    },
  }
}

const context = vi.hoisted(() => ({
  tournamentData: {
    status: 'ready' as const,
    data: {
      tournament: { id: 'tournament-1', lockAt: '2026-07-01T12:00:00.000Z' },
      teams: [
        { id: 'team-a', name: 'Scotland' },
        { id: 'team-b', name: 'England' },
      ],
      groups: [{ id: 'group-a' }],
      matches: [
        {
          id: 'match-1',
          round: 'group',
          groupId: 'group-a',
          homeTeamId: 'team-a',
          awayTeamId: 'team-b',
          homeScore: 2,
          awayScore: 1,
          resultState: 'confirmed',
        },
      ],
    },
  },
  predictions: {
    ready: true,
    getPrediction: vi.fn(() => ({ homeScore: 2, awayScore: 1, joker: false })),
    bracketProgression: {
      'team-a': 'champion',
      'team-b': 'final',
    },
  },
}))

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1', displayName: 'You Player' }),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => context.tournamentData,
}))

vi.mock('../../../src/app/providers/PredictionsProvider', () => ({
  usePredictions: () => context.predictions,
}))

vi.mock('../../../src/services/supabase/h2h', () => ({
  fetchRivalEntry: mocks.fetchRivalEntry,
}))

vi.mock('../../../src/services/supabase/leaderboard', () => ({
  fetchLeaderboardPage: mocks.fetchLeaderboardPage,
}))

vi.mock('../../../src/services/supabase/h2hRankHistory', () => ({
  fetchH2HRankHistory: mocks.fetchH2HRankHistory,
}))

function page() {
  return (
    <MemoryRouter initialEntries={['/h2h/rival-1']}>
      <Routes>
        <Route path="/h2h/:rivalId" element={<H2HPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderPage() {
  return render(page())
}

function rivalEntry() {
  return {
    displayName: 'Rival Player',
    totalPoints: 25,
    predictions: {
      groupMatches: [
        {
          matchId: 'match-1',
          homeScore: 2,
          awayScore: 1,
          joker: false,
        },
      ],
      progression: [
        { teamId: 'team-a', stage: 'CHAMPION' },
        { teamId: 'team-b', stage: 'FINAL' },
      ],
    },
  }
}

function expectTotals(text: string) {
  return waitFor(() =>
    expect(
      screen.getByText((_, element) => element?.textContent?.trim() === text),
    ).toBeVisible(),
  )
}

function expectExactScores(text: string) {
  return waitFor(() =>
    expect(screen.getByText('Exact scores').parentElement).toHaveTextContent(text),
  )
}

async function expectRivalVisible() {
  const matches = await screen.findAllByText('Rival Player')
  expect(matches[0]).toBeVisible()
}

describe('H2HPage resilient states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    context.tournamentData = tournamentData()
    context.predictions = predictionData()
    mocks.fetchRivalEntry.mockResolvedValue(rivalEntry())
    mocks.fetchLeaderboardPage.mockResolvedValue({
      rows: [],
      totalCount: 2,
      pageSize: 1,
      hasMore: false,
      nextCursor: null,
      you: {
        displayName: 'You Player',
        totalPoints: 12,
        rank: 2,
        tied: false,
        position: 2,
      },
    })
    mocks.fetchH2HRankHistory.mockResolvedValue({ you: [], rival: [] })
  })

  it('retries transient reads without reloading the route', async () => {
    mocks.fetchRivalEntry.mockRejectedValueOnce(new Error('rival read offline'))

    renderPage()

    expect(await screen.findByText('Head-to-head unavailable')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await expectRivalVisible()
    await expectTotals('12 – 25')
    expect(mocks.fetchRivalEntry).toHaveBeenCalledTimes(2)
    expect(mocks.fetchLeaderboardPage).toHaveBeenCalledTimes(2)
  })

  it('recomputes derived statistics when authoritative results refresh', async () => {
    const rendered = renderPage()

    await expectRivalVisible()
    await expectTotals('12 – 25')
    await expectExactScores('1Exact scores1')

    context.tournamentData = tournamentData(0, 0)
    rendered.rerender(page())

    await expectExactScores('0Exact scores0')
    await expectTotals('12 – 25')
    expect(mocks.fetchRivalEntry).toHaveBeenCalledTimes(2)
  })

  it('recomputes derived statistics when own predictions refresh', async () => {
    const rendered = renderPage()

    await expectRivalVisible()
    await expectExactScores('1Exact scores1')

    context.predictions = predictionData(0, 0)
    rendered.rerender(page())

    await expectExactScores('0Exact scores1')
    await expectTotals('12 – 25')
    expect(mocks.fetchRivalEntry).toHaveBeenCalledTimes(2)
  })
})
