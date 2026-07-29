import { describe, it, expect } from 'vitest'
import {
  computeTournamentStats,
  describeMatchSource,
  type SettledResult,
} from '../../src/domain/tournament/tournamentInfo'

const result = (
  ref: string,
  homeTeamId: string,
  awayTeamId: string,
  home: number,
  away: number,
  round = 'group',
): SettledResult => ({ matchRef: ref, round, homeTeamId, awayTeamId, home, away })

describe('computeTournamentStats', () => {
  it('degrades honestly with no results', () => {
    const stats = computeTournamentStats([])
    expect(stats.played).toBe(0)
    expect(stats.totalGoals).toBe(0)
    expect(stats.goalsPerMatch).toBeNull()
    expect(stats.biggestWin).toBeNull()
    expect(stats.highestScoring).toBeNull()
    expect(stats.teamGoals).toEqual([])
  })

  it('totals goals and rounds goals-per-match to one decimal place', () => {
    const stats = computeTournamentStats([
      result('GA-1', 'a1', 'a2', 2, 0),
      result('GA-2', 'a3', 'a4', 1, 1),
      result('GB-1', 'b1', 'b2', 3, 0),
    ])
    expect(stats.played).toBe(3)
    expect(stats.totalGoals).toBe(7)
    expect(stats.goalsPerMatch).toBe(2.3)
  })

  it('biggest win is the widest margin, first on a tie, and never a draw', () => {
    const stats = computeTournamentStats([
      result('GA-1', 'a1', 'a2', 2, 2),
      result('GA-2', 'a3', 'a4', 0, 3),
      result('GB-1', 'b1', 'b2', 4, 1),
    ])
    expect(stats.biggestWin?.matchRef).toBe('GA-2')

    const drawsOnly = computeTournamentStats([result('GA-1', 'a1', 'a2', 1, 1)])
    expect(drawsOnly.biggestWin).toBeNull()
  })

  it('highest-scoring match needs at least one goal', () => {
    const goalless = computeTournamentStats([result('GA-1', 'a1', 'a2', 0, 0)])
    expect(goalless.highestScoring).toBeNull()

    const stats = computeTournamentStats([
      result('GA-1', 'a1', 'a2', 2, 2),
      result('GA-2', 'a3', 'a4', 4, 1),
    ])
    expect(stats.highestScoring?.matchRef).toBe('GA-2')
  })

  it('aggregates per-team goals across matches, most first', () => {
    const stats = computeTournamentStats([
      result('GA-1', 'a1', 'a2', 2, 1),
      result('GA-2', 'a1', 'a3', 3, 0),
      result('GA-3', 'a2', 'a3', 2, 0),
    ])
    expect(stats.teamGoals[0]).toEqual({ teamId: 'a1', goals: 5, played: 2 })
    expect(stats.teamGoals[1]).toEqual({ teamId: 'a2', goals: 3, played: 2 })
    expect(stats.teamGoals[2]).toEqual({ teamId: 'a3', goals: 0, played: 2 })
  })
})

describe('describeMatchSource', () => {
  it('labels every slot-reference form from the fixtures grammar', () => {
    expect(describeMatchSource('W-A')).toBe('Winner Group A')
    expect(describeMatchSource('RU-F')).toBe('Runner-up Group F')
    expect(describeMatchSource('3RD-WB')).toBe('Best third')
    expect(describeMatchSource('W-R16-3')).toBe('Winner R16-3')
    expect(describeMatchSource('W-QF-1')).toBe('Winner QF-1')
    expect(describeMatchSource('W-SF-2')).toBe('Winner SF-2')
  })

  it('passes through anything it does not recognise', () => {
    expect(describeMatchSource('A1')).toBe('A1')
    expect(describeMatchSource('mystery')).toBe('mystery')
  })
})
