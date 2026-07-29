import { describe, expect, it } from 'vitest'
import { areFinalStandingsActive } from '../../src/domain/tournament/finalStandings'
import type { Match } from '../../src/services/supabase/tournamentData'

function match(resultState: Match['resultState'], homeScore: number | null = 1): Match {
  return {
    id: crypto.randomUUID(),
    matchRef: 'M1',
    round: 'group',
    groupId: 'g1',
    matchday: 1,
    homeSource: 'A1',
    awaySource: 'A2',
    homeTeamId: 't1',
    awayTeamId: 't2',
    matchDate: '2028-06-09',
    kickoffAt: '2028-06-09T20:00:00Z',
    venue: 'Test',
    homeScore,
    awayScore: homeScore === null ? null : 0,
    resultState,
  }
}

describe('final standings activation', () => {
  it('requires every tournament fixture to be confirmed or corrected', () => {
    expect(areFinalStandingsActive([match('confirmed'), match('corrected')])).toBe(true)
    expect(areFinalStandingsActive([match('confirmed'), match('scheduled', null)])).toBe(false)
  })

  it('never treats an empty fixture list as final', () => {
    expect(areFinalStandingsActive([])).toBe(false)
  })

  it('supports minimal legacy fixtures through paired scores', () => {
    expect(areFinalStandingsActive([match(undefined, 2)])).toBe(true)
    expect(areFinalStandingsActive([match(undefined, null)])).toBe(false)
  })
})
