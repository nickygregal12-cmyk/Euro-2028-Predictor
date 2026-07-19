import { describe, it, expect } from 'vitest'
import {
  calculateLeagueRank,
  leagueTieBreakStats,
  type LeagueEntry,
} from '../../src/domain/tournament/calculateLeagueRank'
import { calculateScore } from '../../src/domain/tournament/calculateScore'

// A "baseline" entry; override one field per test to isolate a criterion.
function entry(entryId: string, over: Partial<LeagueEntry> = {}): LeagueEntry {
  return {
    entryId,
    totalPoints: 100,
    exactScores: 5,
    correctOutcomes: 10,
    correctKnockoutTeams: 4,
    correctChampion: true,
    totalGoalsDiff: 3,
    ...over,
  }
}

const order = (ranked: { entryId: string }[]) => ranked.map((e) => e.entryId)

describe('calculateLeagueRank', () => {
  it('ranks by total points first', () => {
    const ranked = calculateLeagueRank([
      entry('a', { totalPoints: 90 }),
      entry('b', { totalPoints: 120 }),
      entry('c', { totalPoints: 105 }),
    ])
    expect(order(ranked)).toEqual(['b', 'c', 'a'])
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3])
    expect(ranked.every((e) => !e.tied)).toBe(true)
  })

  it('breaks a points tie on most exact scores (criterion 1)', () => {
    // a has more exact scores but is worse on every later criterion.
    const ranked = calculateLeagueRank([
      entry('b', { exactScores: 5, correctOutcomes: 20, correctKnockoutTeams: 8, correctChampion: true, totalGoalsDiff: 0 }),
      entry('a', { exactScores: 6, correctOutcomes: 5, correctKnockoutTeams: 0, correctChampion: false, totalGoalsDiff: 100 }),
    ])
    expect(order(ranked)).toEqual(['a', 'b'])
  })

  it('breaks a tie on most correct outcomes (criterion 2)', () => {
    const ranked = calculateLeagueRank([
      entry('b', { exactScores: 5, correctOutcomes: 10, correctKnockoutTeams: 8, correctChampion: true, totalGoalsDiff: 0 }),
      entry('a', { exactScores: 5, correctOutcomes: 12, correctKnockoutTeams: 0, correctChampion: false, totalGoalsDiff: 100 }),
    ])
    expect(order(ranked)).toEqual(['a', 'b'])
  })

  it('breaks a tie on most correct knockout teams (criterion 3)', () => {
    const ranked = calculateLeagueRank([
      entry('b', { correctKnockoutTeams: 4, correctChampion: true, totalGoalsDiff: 0 }),
      entry('a', { correctKnockoutTeams: 6, correctChampion: false, totalGoalsDiff: 100 }),
    ])
    expect(order(ranked)).toEqual(['a', 'b'])
  })

  it('breaks a tie on the correct champion (criterion 4)', () => {
    const ranked = calculateLeagueRank([
      entry('b', { correctChampion: false, totalGoalsDiff: 0 }),
      entry('a', { correctChampion: true, totalGoalsDiff: 100 }),
    ])
    expect(order(ranked)).toEqual(['a', 'b'])
  })

  it('breaks a tie on the closest total-goals prediction (criterion 5)', () => {
    const ranked = calculateLeagueRank([
      entry('b', { totalGoalsDiff: 5 }),
      entry('c', { totalGoalsDiff: null }), // no prediction → ranked last
      entry('a', { totalGoalsDiff: 2 }),
    ])
    expect(order(ranked)).toEqual(['a', 'b', 'c'])
  })

  it('shares a rank when entries are level on every criterion', () => {
    const ranked = calculateLeagueRank([
      entry('a'),
      entry('b'), // identical to a
      entry('c', { totalPoints: 80 }),
    ])
    expect(ranked.find((e) => e.entryId === 'a')!.rank).toBe(1)
    expect(ranked.find((e) => e.entryId === 'b')!.rank).toBe(1)
    expect(ranked.find((e) => e.entryId === 'c')!.rank).toBe(3) // competition ranking skips 2
    expect(ranked.find((e) => e.entryId === 'a')!.tied).toBe(true)
    expect(ranked.find((e) => e.entryId === 'b')!.tied).toBe(true)
    expect(ranked.find((e) => e.entryId === 'c')!.tied).toBe(false)
  })

  it('returns an empty array for no entries', () => {
    expect(calculateLeagueRank([])).toEqual([])
  })
})

describe('leagueTieBreakStats', () => {
  it('derives the tie-break stats from a score breakdown', () => {
    const breakdown = calculateScore(
      {
        groupMatches: [
          { matchId: 'm1', homeScore: 2, awayScore: 1 }, // exact
          { matchId: 'm2', homeScore: 1, awayScore: 0 }, // correct
          { matchId: 'm3', homeScore: 0, awayScore: 0 }, // wrong
        ],
        knockout: [
          { teamId: 'x', stage: 'CHAMPION' }, // full → correct champion
          { teamId: 'y', stage: 'QF' }, // reaches R16 only → some points
          { teamId: 'z', stage: 'R16' }, // eliminated in groups → 0
        ],
        bonus: { totalGoals: 138 },
      },
      {
        groupMatches: [
          { matchId: 'm1', homeScore: 2, awayScore: 1 },
          { matchId: 'm2', homeScore: 3, awayScore: 2 },
          { matchId: 'm3', homeScore: 1, awayScore: 0 },
        ],
        knockout: [
          { teamId: 'x', stage: 'CHAMPION' },
          { teamId: 'y', stage: 'R16' },
          // z never reached the knockouts → not present
        ],
        bonus: { totalGoals: 140 },
      }
    )

    const stats = leagueTieBreakStats(breakdown)
    expect(stats.exactScores).toBe(1)
    expect(stats.correctOutcomes).toBe(2) // exact + correct
    expect(stats.correctKnockoutTeams).toBe(2) // x and y earned points; z did not
    expect(stats.correctChampion).toBe(true)
    expect(stats.totalGoalsDiff).toBe(2)
  })

  it('reports a null total-goals difference when there is no bonus prediction', () => {
    const breakdown = calculateScore({}, {})
    expect(leagueTieBreakStats(breakdown).totalGoalsDiff).toBeNull()
    expect(leagueTieBreakStats(breakdown).correctChampion).toBe(false)
  })
})
