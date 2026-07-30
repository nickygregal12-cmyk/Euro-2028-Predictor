import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchCentrePage } from '../../../src/features/matches/MatchCentrePage'

const mocks = vi.hoisted(() => ({
  fetchMyLeagues: vi.fn(),
  fetchMatchDistribution: vi.fn(),
  fetchLeagueMatchPicks: vi.fn(),
}))

vi.mock('../../../src/app/providers/TournamentDataProvider', () => ({
  useTournamentData: () => ({
    status: 'ready',
    data: {
      tournament: { id: 'tournament-1' },
      groups: [{ id: 'group-a', letter: 'A' }],
      teams: [
        { id: 'team-home', name: 'Scotland' },
        { id: 'team-away', name: 'England' },
      ],
      matches: [
        {
          id: 'match-1',
          matchRef: 'M1',
          round: 'group',
          groupId: 'group-a',
          homeTeamId: 'team-home',
          awayTeamId: 'team-away',
          homeScore: null,
          awayScore: null,
          venue: 'Hampden Park',
          matchDate: '2028-06-09',
          kickoffAt: '2028-06-09T20:00:00Z',
        },
      ],
    },
  }),
}))

vi.mock('../../../src/app/providers/PredictionsProvider', () => ({
  usePredictions: () => ({
    ready: true,
    getPrediction: () => ({ homeScore: null, awayScore: null, joker: false }),
    bracketProgression: {},
  }),
}))

vi.mock('../../../src/services/supabase/leagues', () => ({
  fetchMyLeagues: mocks.fetchMyLeagues,
}))

vi.mock('../../../src/services/supabase/matchCentre', () => ({
  fetchMatchDistribution: mocks.fetchMatchDistribution,
  fetchLeagueMatchPicks: mocks.fetchLeagueMatchPicks,
}))

vi.mock('../../../src/features/matches/MatchCentreScreen', () => ({
  MatchCentreScreen: (props: {
    leagueScopesStatus?: string
    leagueScopesMessage?: string | null
    leagues: { id: string; name: string }[]
    scope: { type: 'overall' } | { type: 'league'; id: string; name: string }
    onRetryLeagueScopes?: () => void
  }) => (
    <div>
      <span>league-status:{props.leagueScopesStatus}</span>
      <span>league-count:{props.leagues.length}</span>
      <span>
        active-scope:{props.scope.type === 'league' ? props.scope.id : 'overall'}
      </span>
      {props.leagueScopesMessage ? <span>{props.leagueScopesMessage}</span> : null}
      {props.onRetryLeagueScopes ? (
        <button type="button" onClick={props.onRetryLeagueScopes}>
          Retry league scopes
        </button>
      ) : null}
    </div>
  ),
}))

function renderPage(query = '') {
  render(
    <MemoryRouter initialEntries={[`/match/M1${query}`]}>
      <Routes>
        <Route path="/match/:matchRef" element={<MatchCentrePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MatchCentrePage league scope availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchMyLeagues.mockResolvedValue([])
    mocks.fetchMatchDistribution.mockResolvedValue({
      locked: false,
      predictedCount: 1,
      totalEntries: 2,
    })
    mocks.fetchLeagueMatchPicks.mockResolvedValue({
      locked: false,
      predictedCount: 1,
      totalMembers: 4,
    })
  })

  it('keeps a failed league read distinct from a successful empty account', async () => {
    mocks.fetchMyLeagues.mockRejectedValueOnce(new Error('league scopes offline'))

    renderPage()

    expect(await screen.findByText('league-status:unavailable')).toBeVisible()
    expect(screen.getByText('league-count:0')).toBeVisible()
    expect(screen.getByText('active-scope:overall')).toBeVisible()
    expect(screen.getByText(/Could not load your league scopes/)).toBeVisible()
    expect(mocks.fetchMatchDistribution).toHaveBeenCalledWith('match-1')
  })

  it('retains a genuine ready empty result without an unavailable message', async () => {
    renderPage()

    expect(await screen.findByText('league-status:ready')).toBeVisible()
    expect(screen.getByText('league-count:0')).toBeVisible()
    expect(screen.queryByText(/Could not load your league scopes/)).not.toBeInTheDocument()
  })

  it('retries only the league source and restores a requested league scope', async () => {
    mocks.fetchMyLeagues
      .mockRejectedValueOnce(new Error('league scopes offline'))
      .mockResolvedValueOnce([
        {
          id: 'league-1',
          name: 'Weekend League',
          inviteCode: 'ABC123',
          memberCount: 4,
          isOwner: true,
          ownerName: 'Profile Tester',
        },
      ])

    renderPage('?league=league-1')

    fireEvent.click(await screen.findByRole('button', { name: 'Retry league scopes' }))

    await waitFor(() => {
      expect(screen.getByText('league-status:ready')).toBeVisible()
      expect(screen.getByText('league-count:1')).toBeVisible()
      expect(screen.getByText('active-scope:league-1')).toBeVisible()
      expect(mocks.fetchMyLeagues).toHaveBeenCalledTimes(2)
      expect(mocks.fetchLeagueMatchPicks).toHaveBeenCalledWith('league-1', 'match-1')
    })
  })
})
