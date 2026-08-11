import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  MatchCentreScreen,
  type MatchCentreScreenProps,
} from '../../../src/features/matches/MatchCentreScreen'
import type { LeagueGroupPickRow } from '../../../src/domain/tournament/matchCentre'

/**
 * Contract 171 in the Match Centre's "Your leagues" section.
 *
 * `get_league_match_picks` has capped at 250 rows since contract 44 and said
 * nothing about it, so a league of 300 rendered 250 named members beside a
 * league the same screen elsewhere calls 300 strong. Fifty people looked like
 * they had not predicted. The cap is unchanged; what changed is that the server
 * now says it capped, and this proves the screen repeats it.
 */

function rows(count: number): LeagueGroupPickRow[] {
  return Array.from({ length: count }, (_, index) => ({
    displayName: `Member ${index + 1}`,
    isYou: index === 0,
    homeScore: 1,
    awayScore: 0,
    joker: false,
    outcome: 'unknown' as const,
    points: null,
  }))
}

function baseProps(): MatchCentreScreenProps {
  return {
    eyebrow: 'Group A · Full time',
    venue: 'Wembley Stadium',
    venueCountryCode: 'gb-eng',
    home: { name: 'Scotland', countryCode: 'gb-sct' },
    away: { name: 'Germany', countryCode: 'de' },
    result: { home: 1, away: 0 },
    stake: {
      kind: 'group',
      stake: { kind: 'group', pick: null, outcome: 'unknown', points: null },
    },
    scope: { type: 'league', id: 'league-1', name: 'The Office' },
    leagues: [{ id: 'league-1', name: 'The Office' }],
    said: { revealed: true, kind: 'league-group', rows: rows(8) },
    scoreEvents: [],
  }
}

describe('a truncated league pick list', () => {
  it('says how many of the league it is showing, and what that does not mean', () => {
    render(
      <MatchCentreScreen
        {...baseProps()}
        said={{
          revealed: true,
          kind: 'league-group',
          rows: rows(8),
          coverage: { returned: 250, total: 300, truncated: true },
        }}
      />,
    )

    expect(screen.getByText(/Showing 250 of 300 league members/)).toBeInTheDocument()
    expect(
      screen.getByText(/that is not a record of who predicted/),
    ).toBeInTheDocument()
  })

  it('stops the expand control restating the number the notice just corrected', () => {
    render(
      <MatchCentreScreen
        {...baseProps()}
        said={{
          revealed: true,
          kind: 'league-group',
          rows: rows(8),
          coverage: { returned: 250, total: 300, truncated: true },
        }}
      />,
    )

    // "Show all 8 members" beside a 300-member league is the same false claim
    // in a smaller font.
    expect(screen.queryByRole('button', { name: /Show all 8 members/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Show all 8 listed/ })).toBeInTheDocument()
  })

  it('adds nothing at all when the server carried the whole league', () => {
    render(
      <MatchCentreScreen
        {...baseProps()}
        said={{
          revealed: true,
          kind: 'league-group',
          rows: rows(8),
          coverage: { returned: 8, total: 8, truncated: false },
        }}
      />,
    )

    expect(screen.queryByText(/Showing/)).toBeNull()
    expect(screen.getByRole('button', { name: /Show all 8 members/ })).toBeInTheDocument()
  })

  it('adds nothing for a server that predates contract 171', () => {
    render(<MatchCentreScreen {...baseProps()} />)

    expect(screen.queryByText(/Showing/)).toBeNull()
  })
})
