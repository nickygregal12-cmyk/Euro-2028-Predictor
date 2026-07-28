import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { H2HPage } from '../../../src/features/h2h/H2HPage'

const mocks = vi.hoisted(() => ({
  fetchRivalEntry: vi.fn(),
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
    totalPoints: 5,
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

describe('H2HPage resilient states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    context.tournamentData = tournamentData()
    mocks.fetchRivalEntry.mockResolvedValue(rivalEntry())
  })

  it('retries a transient rival read without reloading the route', async () => {
    mocks.fetchRivalEntry.mockRejectedValueOnce(new Error('rival read offline'))

    renderPage()

    expect(await screen.findByText('Head-to-head unavailable')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Rival Player')).toBeVisible()
    await expectTotals('5 – 5')
    expect(mocks.fetchRivalEntry).toHaveBeenCalledTimes(2)
  })

  it('recomputes both sides when authoritative results refresh', async () => {
    const rendered = renderPage()

    expect(await screen.findByText('Rival Player')).toBeVisible()
    await expectTotals('5 – 5')

    context.tournamentData = tournamentData(0, 0)
    rendered.rerender(page())

    await expectTotals('0 – 0')
    expect(mocks.fetchRivalEntry).toHaveBeenCalledTimes(2)
  })
})
