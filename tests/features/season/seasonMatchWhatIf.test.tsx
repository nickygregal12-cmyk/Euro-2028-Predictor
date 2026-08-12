import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeasonMatchWhatIf } from '../../../src/features/season/SeasonMatchWhatIf'
import {
  mapSeasonMatchweekProjection,
  type SeasonMatchweekProjection,
} from '../../../src/services/supabase/seasonMatchweekProjectionModel'

/**
 * `INNOV-001` on screen, over contract 175. The rendering test exists for one
 * reason above all others: every figure has to read as a projection of the
 * MATCHWEEK, and the panel must vanish rather than explain itself when there is
 * nothing to project.
 */

type Payload = Record<string, unknown>

function decode(over: Payload = {}, fixtureOver: Payload = {}): SeasonMatchweekProjection {
  return mapSeasonMatchweekProjection({
    server_now: '2026-08-12T14:20:00Z',
    tournament_id: 't-1',
    matchweek: { matchweek_id: 'r-1', ordinal: 5, label: 'Matchweek 5' },
    locks_at: '2026-08-12T11:30:00Z',
    locked: true,
    joker_played: false,
    projected_points: 8,
    settled: false,
    league: null,
    fixtures: [
      {
        fixture_id: 'fx-1',
        home_team_id: 'team-h',
        away_team_id: 'team-a',
        kickoff_at: '2026-08-12T14:00:00Z',
        status: 'scheduled',
        basis: 'provisional',
        official: null,
        provisional: {
          home: 1,
          away: 1,
          provider_status: 'IN_PLAY',
          kind: 'in_play',
          observed_at: '2026-08-12T14:19:00Z',
        },
        prediction: { home: 2, away: 1 },
        points: 0,
        branches: {
          home_scores: { home: 2, away: 1, matchweek_points: 13 },
          away_scores: { home: 1, away: 2, matchweek_points: 8 },
        },
        ...fixtureOver,
      },
    ],
    ...over,
  })
}

const panel = (projection: SeasonMatchweekProjection) => (
  <SeasonMatchWhatIf
    projection={projection}
    fixtureId="fx-1"
    homeName="Liverpool"
    awayName="Arsenal"
  />
)

const revealedLeague = {
  league_id: 'lg-1',
  name: 'The Office',
  revealed: true,
  reason: null,
  locks_at: '2026-08-12T11:30:00Z',
  members_total: 12,
  members_returned: 2,
  members_truncated: true,
  table: [
    {
      user_id: 'u-craig',
      display_name: 'Craig',
      is_self: false,
      entered: true,
      banked_points: 43,
      projected_matchweek_points: 11,
      projected_points: 54,
      current_rank: 1,
      projected_rank: 1,
    },
    {
      user_id: 'u-me',
      display_name: 'You',
      is_self: true,
      entered: true,
      banked_points: 40,
      projected_matchweek_points: 8,
      projected_points: 48,
      current_rank: 3,
      projected_rank: 2,
    },
  ],
}

describe('SeasonMatchWhatIf', () => {
  it('renders nothing at all once the matchweek is banked', () => {
    const { container } = render(panel(decode({ settled: true })))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing at all for a fixture with an official result', () => {
    const { container } = render(
      panel(
        decode({}, { basis: 'official', official: { home: 2, away: 1 }, provisional: null, branches: null }),
      ),
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing at all when no provider score has been reported', () => {
    const { container } = render(
      panel(decode({}, { basis: 'none', provisional: null, branches: null })),
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('names all three branches and says every figure is a projected matchweek total', () => {
    render(panel(decode()))

    expect(screen.getByRole('heading', { name: 'Projection' })).toBeInTheDocument()
    expect(screen.getByText('As it stands')).toBeInTheDocument()
    expect(screen.getByText('If Liverpool score')).toBeInTheDocument()
    expect(screen.getByText('If Arsenal score')).toBeInTheDocument()
    expect(screen.getAllByText(/projected pts?$/).length).toBe(3)
    expect(screen.getAllByText('Matchweek total').length).toBe(3)
    expect(screen.getByText(/Projected, never awarded/)).toBeInTheDocument()
  })

  it('marks an exact branch with a word and not only a colour', () => {
    render(panel(decode()))
    expect(screen.getByText('Exact')).toBeInTheDocument()
    expect(
      screen.getByText(/Your prediction would be exact\. 5 more across the matchweek\./),
    ).toBeInTheDocument()
  })

  it('says the Joker is already applied rather than doubling anything on screen', () => {
    render(panel(decode({ joker_played: true })))
    expect(screen.getAllByText('Matchweek total, Joker applied').length).toBe(3)
    expect(screen.getByText(/Your Joker is already applied/)).toBeInTheDocument()
  })

  it('shows a hidden league as hidden by rule, with no member rows', () => {
    render(
      panel(
        decode({
          locked: false,
          league: {
            league_id: 'lg-1',
            name: 'The Office',
            revealed: false,
            reason: 'matchweek_not_locked',
            locks_at: '2026-08-15T11:30:00Z',
            members_returned: 0,
            members_truncated: false,
            table: [],
          },
        }),
      ),
    )
    expect(screen.getByText(/league projections open when matchweek 5 locks/i)).toBeInTheDocument()
    expect(screen.queryByText('Craig')).not.toBeInTheDocument()
  })

  it('reports the server rank movement, the truncation and the scope of the league block', () => {
    render(panel(decode({ league: revealedLeague })))
    expect(screen.getByText(/Projected 2nd of 12/)).toBeInTheDocument()
    expect(screen.getByText(/up from 3rd/)).toBeInTheDocument()
    expect(screen.getByText(/6 behind Craig/)).toBeInTheDocument()
    expect(screen.getByText(/Showing 2 of 12 members/)).toBeInTheDocument()
    expect(
      screen.getByText(/This is not projected forward from the next goal/),
    ).toBeInTheDocument()
  })

  it('says the player has no prediction rather than showing them a zero', () => {
    render(panel(decode({}, { prediction: null })))
    // Said in the lede and again on each branch, because a branch that would
    // change nothing for this player must say why rather than print a bare 8.
    expect(screen.getAllByText(/You have no prediction on this fixture\./).length).toBe(4)
  })
})
