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
  competitionTimeZone: 'Europe/London',
  bounds: { startsAt: '2028-06-09T00:00:00Z', endsAt: '2028-07-09T23:59:59Z' },
  primaryStage: 'groups',
  progression: 'groups_to_knockout',
  groupStage: { groupCount: 6, matchdayCount: 3 },
  knockoutStage: { roundCount: 4 },
}

const leagueSeason: LeagueSeasonCompetitionConfig = {
  id: 'premier-league-2027-28',
  name: 'Premier League 2027/28',
  kind: 'league_season',
  competitionTimeZone: 'Europe/London',
  bounds: { startsAt: '2027-08-01T00:00:00Z', endsAt: '2028-05-31T23:59:59Z' },
  primaryStage: 'league',
  progression: 'rolling_matchweeks',
  matchweeks: { count: 38 },
}

describe('competition kinds', () => {
  it('recognises a bounded tournament', () => {
    expect(isTournamentCompetitionConfig(tournament)).toBe(true)
    expect(isLeagueSeasonCompetitionConfig(tournament)).toBe(false)
    expect(isCompetitionConfig(tournament)).toBe(true)
  })

  it('recognises a rolling league season', () => {
    expect(isLeagueSeasonCompetitionConfig(leagueSeason)).toBe(true)
    expect(isTournamentCompetitionConfig(leagueSeason)).toBe(false)
    expect(isCompetitionConfig(leagueSeason)).toBe(true)
  })

  it('rejects a season without a positive whole matchweek count', () => {
    expect(isCompetitionConfig({ ...leagueSeason, matchweeks: { count: 0 } })).toBe(false)
    expect(isCompetitionConfig({ ...leagueSeason, matchweeks: { count: 38.5 } })).toBe(false)
  })

  it('carries no lock policy: lock behaviour belongs to the selected game', () => {
    // The competition describes identity, calendar and structure only. Lock
    // policy moved to the game (ADR 0020), so the same season can host a
    // zero-buffer Main Predictor and a 30-minute Last Man Standing at once.
    expect('lockPolicy' in tournament).toBe(false)
    expect('lockPolicy' in leagueSeason).toBe(false)
  })
})
