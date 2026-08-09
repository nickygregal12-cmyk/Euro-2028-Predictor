import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  HeadToHeadHiddenError,
  OpponentNotEnteredError,
  mapSeasonHeadToHead,
} from '../../../src/services/supabase/seasonHeadToHeadModel'
import { SeasonHeadToHead } from '../../../src/features/season/SeasonHeadToHead'
import { SeasonLeagueStandings } from '../../../src/features/season/SeasonLeagueStandings'
import type { SeasonLeagueStandingsPage } from '../../../src/services/supabase/seasonLeagueStandings'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    matchweek: 2,
    locked_at: '2026-08-08T13:30:00Z',
    you: {
      user_id: 'you',
      display_name: 'You',
      points: 12,
      joker: true,
      predicted: 3,
      season_points: 84,
    },
    opponent: {
      user_id: 'rival',
      display_name: 'Sam',
      points: null,
      joker: false,
      predicted: 2,
      season_points: 79,
    },
    fixtures: [
      {
        id: 'f1',
        kickoff_at: '2026-08-08T14:00:00Z',
        status: 'played',
        home_name: 'Rangers',
        away_name: 'Hibernian',
        result_home: 2,
        result_away: 1,
        your_prediction: { home: 2, away: 1 },
        their_prediction: null,
      },
    ],
    ...overrides,
  }
}

describe('decoding a season head-to-head', () => {
  it('keeps an unsettled matchweek null rather than zero', () => {
    // `season_matchweek_scores` distinguishes "no settled matchweek" from
    // "settled at nothing"; rendering the first as 0 invents a result.
    const h2h = mapSeasonHeadToHead(payload())
    expect(h2h.you.points).toBe(12)
    expect(h2h.opponent.points).toBeNull()
  })

  it('drops a half-prediction rather than showing one side of it', () => {
    const broken = payload()
    ;(broken.fixtures[0] as Record<string, unknown>).your_prediction = { home: 2 }
    expect(mapSeasonHeadToHead(broken).fixtures[0]?.yours).toBeNull()
  })

  it('shows a score only when the server holds both halves', () => {
    const partial = payload()
    ;(partial.fixtures[0] as Record<string, unknown>).result_away = null
    expect(mapSeasonHeadToHead(partial).fixtures[0]?.resultHome).toBeNull()
  })

  it('refuses a payload it cannot identify', () => {
    expect(() => mapSeasonHeadToHead({ fixtures: [] })).toThrow()
  })
})

describe('the head-to-head panel', () => {
  const close = () => {}

  it('explains the lock rather than reporting a failure', async () => {
    render(
      <SeasonHeadToHead
        opponentName="Sam"
        matchweek={2}
        onClose={close}
        load={() => Promise.reject(new HeadToHeadHiddenError())}
      />,
    )
    await waitFor(() => expect(screen.getByText(/has not locked yet/)).toBeTruthy())
  })

  it('keeps "not entered" apart from "not yet", because waiting will not fix it', async () => {
    render(
      <SeasonHeadToHead
        opponentName="Sam"
        matchweek={2}
        onClose={close}
        load={() => Promise.reject(new OpponentNotEnteredError())}
      />,
    )
    await waitFor(() => expect(screen.getByText(/has not entered this season/)).toBeTruthy())
    expect(screen.queryByText(/has not locked yet/)).toBeNull()
  })

  it('reports a genuine failure as one, and says the caller is unaffected', async () => {
    render(
      <SeasonHeadToHead
        opponentName="Sam"
        matchweek={2}
        onClose={close}
        load={() => Promise.reject(new Error('network'))}
      />,
    )
    await waitFor(() => expect(screen.getByText(/could not be loaded/)).toBeTruthy())
    expect(screen.getByText(/points are unaffected/)).toBeTruthy()
  })

  it('renders an unsettled matchweek as a dash, not a nought', async () => {
    render(
      <SeasonHeadToHead
        opponentName="Sam"
        matchweek={2}
        onClose={close}
        load={() => Promise.resolve(mapSeasonHeadToHead(payload()))}
      />,
    )
    await waitFor(() => expect(screen.getByText('12')).toBeTruthy())
    // Two dashes: the rival's unsettled matchweek total, and their missing
    // prediction on the one fixture. Both are the same distinction — absent is
    // not zero — so both render the same way.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})

function standingsPage(): SeasonLeagueStandingsPage {
  const base = {
    points: 84,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    isOwner: false,
    hasEntry: true,
  }
  return {
    rows: [
      { ...base, userId: 'you', displayName: 'You', position: 1, isYou: true },
      { ...base, userId: 'rival', displayName: 'Sam', position: 2, rank: 2, isYou: false },
      {
        ...base,
        userId: 'absent',
        displayName: 'Pat',
        position: 3,
        rank: 3,
        isYou: false,
        hasEntry: false,
        points: 0,
        matchweeksPlayed: 0,
      },
    ],
    totalCount: 3,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you: { ...base, userId: 'you', displayName: 'You', position: 1 },
  }
}

function renderTable(headToHead?: {
  matchweek: number
  load: (opponentId: string) => Promise<ReturnType<typeof mapSeasonHeadToHead>>
}) {
  return render(
    <SeasonLeagueStandings
      gateway={{ load: () => Promise.resolve(standingsPage()) }}
      leagueId="league-1"
      leagueName="The Office"
      headToHead={headToHead}
    />,
  )
}

describe('reaching a head-to-head from a league table', () => {
  it('offers no comparison against yourself or a member who has not entered', async () => {
    // The server would refuse both — comparing yourself with yourself raises,
    // and a non-entrant has nothing to compare — so neither gets a control.
    renderTable({ matchweek: 2, load: () => Promise.resolve(mapSeasonHeadToHead(payload())) })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Compare this matchweek with Sam/ })).toBeTruthy(),
    )
    expect(screen.queryByRole('button', { name: /with You/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /with Pat/ })).toBeNull()
  })

  it('offers none at all when the season has no matchweek to compare', async () => {
    // A finished season resolves no matchweek, so the route supplies no reader
    // and the rows carry no control rather than one that refuses.
    renderTable()
    await waitFor(() => expect(screen.getByText('Sam')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Compare this matchweek/ })).toBeNull()
  })

  it('opens the comparison for the rival whose row was pressed', async () => {
    const asked: string[] = []
    renderTable({
      matchweek: 2,
      load: (opponentId) => {
        asked.push(opponentId)
        return Promise.resolve(mapSeasonHeadToHead(payload()))
      },
    })

    const compare = await screen.findByRole('button', {
      name: /Compare this matchweek with Sam/,
    })
    fireEvent.click(compare)

    await waitFor(() => expect(screen.getByText('You against Sam')).toBeTruthy())
    expect(asked).toEqual(['rival'])
  })
})
