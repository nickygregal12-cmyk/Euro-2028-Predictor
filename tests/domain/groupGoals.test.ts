import { describe, it, expect } from 'vitest'
import { sumGroupGoals } from '../../src/domain/tournament/groupGoals'

describe('sumGroupGoals', () => {
  it('sums home+away across fully-predicted matches', () => {
    const result = sumGroupGoals([
      { homeScore: 2, awayScore: 1 },
      { homeScore: 0, awayScore: 0 },
      { homeScore: 3, awayScore: 2 },
    ])
    expect(result).toEqual({ total: 8, predictedCount: 3, matchCount: 3 })
  })

  it('ignores matches with a missing score (running total)', () => {
    const result = sumGroupGoals([
      { homeScore: 2, awayScore: 1 },
      { homeScore: 1, awayScore: null }, // not yet complete
      { homeScore: null, awayScore: null },
    ])
    expect(result).toEqual({ total: 3, predictedCount: 1, matchCount: 3 })
  })

  it('is zero for no predictions', () => {
    expect(sumGroupGoals([])).toEqual({ total: 0, predictedCount: 0, matchCount: 0 })
  })
})
