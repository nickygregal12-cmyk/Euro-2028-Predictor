import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Group, Match, Team } from '../../../src/services/supabase/tournamentData'
import { createMatchCentrePageModel } from '../../../src/domain/tournament/matchCentrePageModel'
import { MatchCentreLifecyclePanel } from '../../../src/features/matches/MatchCentreLifecyclePanel'

const groups: Group[] = [{ id: 'group-a', letter: 'A' }]
const teams: Team[] = [
  { id: 'home', name: 'Scotland', groupId: 'group-a', slot: 1 },
  { id: 'away', name: 'Germany', groupId: 'group-a', slot: 2 },
]

function fixture(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    matchRef: 'M01',
    round: 'group',
    groupId: 'group-a',
    matchday: 1,
    homeSource: 'A1',
    awaySource: 'A2',
    homeTeamId: 'home',
    awayTeamId: 'away',
    matchDate: '2028-06-09',
    kickoffAt: '2028-06-09T20:00:00.000Z',
    venue: 'Wembley Stadium',
    homeScore: null,
    awayScore: null,
    ...overrides,
  }
}

describe('Match Centre lifecycle page-model integration', () => {
  it('renders pre-match content supplied by the page model', () => {
    const model = createMatchCentrePageModel({
      match: fixture(),
      teams,
      groups,
      now: '2028-06-09T19:30:00.000Z',
      fetchedAt: '2028-06-09T19:30:00.000Z',
    })

    render(<MatchCentreLifecyclePanel content={model.lifecycleContent} />)

    expect(screen.getByRole('region', { name: 'Starting soon' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'The match is close to kick-off. Predictions remain hidden until the entry lock is confirmed.',
      ),
    ).toBeInTheDocument()
  })

  it('renders full-time content supplied by the page model', () => {
    const model = createMatchCentrePageModel({
      match: fixture({ homeScore: 2, awayScore: 1 }),
      teams,
      groups,
      now: '2028-06-09T22:00:00.000Z',
    })

    render(<MatchCentreLifecyclePanel content={model.lifecycleContent} />)

    expect(screen.getByRole('region', { name: 'Match complete' })).toBeInTheDocument()
    expect(model.lifecycleContent.showMatchImpact).toBe(true)
  })
})
