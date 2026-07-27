import { describe, expect, it } from 'vitest'
import {
  authoritativeMatchScore,
  authoritativeWinnerSide,
  eliminatedKnockoutTeamId,
  hasAuthoritativeResult,
  knockoutResultDetail,
} from '../../src/domain/tournament/authoritativeMatchResult'
import type { Match } from '../../src/services/supabase/tournamentData'

function fixture(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    matchRef: 'R16-1',
    round: 'r16',
    groupId: null,
    matchday: null,
    homeSource: 'Winner A',
    awaySource: 'Runner-up C',
    homeTeamId: 'home-team',
    awayTeamId: 'away-team',
    matchDate: '2028-06-24',
    kickoffAt: '2028-06-24T18:00:00Z',
    venue: 'Wembley Stadium',
    homeScore: null,
    awayScore: null,
    resultState: 'scheduled',
    resultMethod: null,
    homeScore90: null,
    awayScore90: null,
    homeScore120: null,
    awayScore120: null,
    homePenalties: null,
    awayPenalties: null,
    winnerTeamId: null,
    ...overrides,
  }
}

describe('authoritative match result derivation', () => {
  it('does not expose stale values on a scheduled row', () => {
    const match = fixture({
      homeScore: 2,
      awayScore: 1,
      winnerTeamId: 'home-team',
    })

    expect(hasAuthoritativeResult(match)).toBe(false)
    expect(authoritativeMatchScore(match)).toBeNull()
    expect(authoritativeWinnerSide(match)).toBeNull()
  })

  it('retains a score-based fallback for legacy completed fixtures', () => {
    const match = fixture({
      resultState: undefined,
      homeScore: 3,
      awayScore: 1,
    })

    expect(hasAuthoritativeResult(match)).toBe(true)
    expect(authoritativeMatchScore(match)).toEqual({ home: 3, away: 1 })
    expect(authoritativeWinnerSide(match)).toBe('home')
  })

  it('uses winner_team_id when a penalty shootout leaves the football score level', () => {
    const match = fixture({
      resultState: 'confirmed',
      resultMethod: 'penalties',
      homeScore: 2,
      awayScore: 2,
      homeScore90: 1,
      awayScore90: 1,
      homeScore120: 2,
      awayScore120: 2,
      homePenalties: 4,
      awayPenalties: 5,
      winnerTeamId: 'away-team',
    })

    expect(authoritativeMatchScore(match)).toEqual({ home: 2, away: 2 })
    expect(authoritativeWinnerSide(match)).toBe('away')
    expect(eliminatedKnockoutTeamId(match)).toBe('home-team')
    expect(knockoutResultDetail(match, 'England', 'Spain')).toBe(
      'Spain won 4–5 on penalties',
    )
  })

  it('labels an extra-time winner without changing the displayed final score', () => {
    const match = fixture({
      resultState: 'corrected',
      resultMethod: 'extra_time',
      homeScore: 2,
      awayScore: 1,
      homeScore90: 1,
      awayScore90: 1,
      homeScore120: 2,
      awayScore120: 1,
      winnerTeamId: 'home-team',
    })

    expect(authoritativeMatchScore(match)).toEqual({ home: 2, away: 1 })
    expect(authoritativeWinnerSide(match)).toBe('home')
    expect(eliminatedKnockoutTeamId(match)).toBe('away-team')
    expect(knockoutResultDetail(match, 'France', 'Germany')).toBe(
      'France won after extra time',
    )
  })

  it('does not treat a group-stage loser as knockout elimination', () => {
    const match = fixture({
      round: 'group',
      groupId: 'group-a',
      matchday: 1,
      resultState: 'confirmed',
      resultMethod: 'regulation',
      homeScore: 2,
      awayScore: 0,
      winnerTeamId: 'home-team',
    })

    expect(authoritativeWinnerSide(match)).toBe('home')
    expect(eliminatedKnockoutTeamId(match)).toBeNull()
    expect(knockoutResultDetail(match, 'Scotland', 'Wales')).toBeNull()
  })

  it('refuses to guess a level knockout result without an authoritative winner', () => {
    const match = fixture({
      resultState: 'confirmed',
      resultMethod: 'penalties',
      homeScore: 1,
      awayScore: 1,
      winnerTeamId: null,
    })

    expect(authoritativeWinnerSide(match)).toBeNull()
    expect(eliminatedKnockoutTeamId(match)).toBeNull()
    expect(knockoutResultDetail(match, 'Italy', 'Portugal')).toBeNull()
  })
})
