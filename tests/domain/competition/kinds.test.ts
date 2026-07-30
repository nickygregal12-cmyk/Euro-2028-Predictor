import { describe, expect, it } from 'vitest'
import {
  isCompetitionConfig,
  isLeagueSeasonCompetitionConfig,
  isTournamentCompetitionConfig,
  type LeagueSeasonCompetitionConfig,
  type TournamentCompetitionConfig,
} from '../../../src/domain/competition/kinds'

const tournament: TournamentCompetitionConfig = {
  id: 'euro-2028',
  name: 'Euro 2028',
  kind: 'tournament',
  timeZone: 'Europe/London',
  bounds: { startsAt: '2028-06-09T00:00:00Z', endsAt: '2028-07-09T23:59:59Z' },
  primaryStage: 'groups',
  progression: 'groups_to_knockout',
  groupStage: { groupCount: 6, matchdayCount: 3 },
  knockoutStage: { roundCount: 4 },
  lockPolicy: { scope: 'entry', scopeCount: 1, bufferMinutes: 0 },
}

const leagueSeason: LeagueSeasonCompetitionConfig = {
  id: 'premier-league-2027-28',
  name: 'Premier League 2027/28',
  kind: 'league_season',
  timeZone: 'Europe/London',
  bounds: { startsAt: '2027-08-01T00:00:00Z', endsAt: '2028-05-31T23:59:59Z' },
  primaryStage: 'league',
  progression: 'rolling_matchweeks',
  matchweeks: { count: 38 },
  lockPolicy: { scope: 'matchweek', scopeCount: 38, bufferMinutes: 30 },
}

describe('competition kinds', () => {
  it('recognises a bounded tournament with one entry lock scope', () => {
    expect(isTournamentCompetitionConfig(tournament)).toBe(true)
    expect(isLeagueSeasonCompetitionConfig(tournament)).toBe(false)
    expect(isCompetitionConfig(tournament)).toBe(true)
  })

  it('recognises a rolling league season with one scope per matchweek', () => {
    expect(isLeagueSeasonCompetitionConfig(leagueSeason)).toBe(true)
    expect(isTournamentCompetitionConfig(leagueSeason)).toBe(false)
    expect(isCompetitionConfig(leagueSeason)).toBe(true)
  })

  it('rejects a season whose declared scope count differs from its matchweek count', () => {
    expect(
      isCompetitionConfig({
        ...leagueSeason,
        lockPolicy: { ...leagueSeason.lockPolicy, scopeCount: 37 },
      }),
    ).toBe(false)
  })
})
