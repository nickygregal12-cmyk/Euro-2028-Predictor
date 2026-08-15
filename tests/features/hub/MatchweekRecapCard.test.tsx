import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { MatchweekRecapCard } from '../../../src/features/hub/MatchweekRecapCard'
import type { MatchweekRecap } from '../../../src/features/hub/matchweekRecapModel'

const RECAP: MatchweekRecap = {
  competitionKey: 'premier-league-2026-27',
  competitionName: 'Premier League',
  href: '/competitions/premier-league/2026-27',
  matchweekLabel: 'Matchweek 4',
  matchweekOrdinal: 4,
  points: 17,
  jokerPlayed: true,
  seasonPoints: 58,
  seasonRank: 12,
  fieldSize: 240,
  exactScores: 6,
  correctOutcomes: 21,
  leagues: [
    {
      leagueId: 'league-1',
      leagueName: 'The Office',
      rankBefore: 5,
      rankAfter: 2,
      movement: 3,
      fieldSize: 14,
      gapToLeaderAfter: 4,
    },
  ],
}

describe('MatchweekRecapCard', () => {
  it('separates matchweek outcome, season context and private-league consequence', () => {
    render(
      <MemoryRouter>
        <MatchweekRecapCard recap={RECAP} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link')).toHaveAttribute('href', RECAP.href)
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('Matchweek points')).toBeInTheDocument()
    expect(screen.getByText('58 pts')).toBeInTheDocument()
    expect(screen.getByText('12th of 240')).toBeInTheDocument()
    expect(screen.getByText('Joker played')).toBeInTheDocument()
    expect(screen.getByText('Up 3')).toBeInTheDocument()
    expect(screen.getByText(/5th to 2nd of 14/)).toBeInTheDocument()
    expect(screen.getByText(/4 pts off lead/)).toBeInTheDocument()
  })

  it('does not invent metrics that the read did not supply', () => {
    const partial: MatchweekRecap = {
      ...RECAP,
      jokerPlayed: false,
      seasonPoints: null,
      seasonRank: null,
      fieldSize: null,
      exactScores: null,
      correctOutcomes: null,
      leagues: [],
    }

    render(
      <MemoryRouter>
        <MatchweekRecapCard recap={partial} />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Joker played')).toBeNull()
    expect(screen.queryByText('Season total')).toBeNull()
    expect(screen.queryByText('Season rank')).toBeNull()
    expect(screen.queryByText('Season exact')).toBeNull()
    expect(screen.queryByText('Season correct')).toBeNull()
    expect(screen.queryByText('Private league movement')).toBeNull()
  })
})
