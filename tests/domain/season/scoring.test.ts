import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEASON_JOKERS_PER_HALF,
  SEASON_JOKERS_PER_SEASON,
  SEASON_PREDICTOR_POINTS,
  scoreFixture,
  scoreMatchweek,
  seasonJokerAllowance,
  validateJokerUsage,
} from '../../../src/domain/season/scoring'

/**
 * ADR 0012 as amended by ADR 0020: the domestic Main Predictor's scoring
 * authority, separate from the tournament implementation on purpose.
 */

describe('per-fixture scoring', () => {
  it('awards 5 for the exact score, replacing the correct-result 3', () => {
    expect(scoreFixture({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(5)
    // Not 8. Exact replaces result; the rule is non-cumulative.
    expect(SEASON_PREDICTOR_POINTS.exactScore).toBe(5)
  })

  it('awards 3 for the correct result on the wrong score', () => {
    expect(scoreFixture({ home: 3, away: 0 }, { home: 1, away: 0 })).toBe(3)
    expect(scoreFixture({ home: 0, away: 0 }, { home: 2, away: 2 })).toBe(3)
    expect(scoreFixture({ home: 0, away: 2 }, { home: 1, away: 3 })).toBe(3)
  })

  it('awards 0 for the wrong result', () => {
    expect(scoreFixture({ home: 2, away: 0 }, { home: 0, away: 2 })).toBe(0)
    expect(scoreFixture({ home: 1, away: 1 }, { home: 1, away: 0 })).toBe(0)
  })

  it('awards 0 for a missing prediction', () => {
    expect(scoreFixture(null, { home: 1, away: 0 })).toBe(0)
    expect(scoreFixture(undefined, { home: 1, away: 0 })).toBe(0)
  })

  it('awards 0 for malformed data — unknown input never scores', () => {
    expect(scoreFixture({ home: -1, away: 0 }, { home: 1, away: 0 })).toBe(0)
    expect(scoreFixture({ home: 1.5, away: 0 }, { home: 1, away: 0 })).toBe(0)
    expect(scoreFixture({ home: 1, away: 0 }, { home: Number.NaN, away: 0 })).toBe(0)
  })
})

describe('matchweek scoring and the whole-matchweek Joker', () => {
  const fixtures = [
    { prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } }, // 5
    { prediction: { home: 1, away: 0 }, result: { home: 3, away: 1 } }, // 3
    { prediction: { home: 0, away: 2 }, result: { home: 2, away: 0 } }, // 0
    { prediction: null, result: { home: 1, away: 1 } }, // 0 — missing
  ]

  it('sums per-fixture points without a Joker', () => {
    expect(scoreMatchweek(fixtures, false)).toEqual({
      basePoints: 8,
      totalPoints: 8,
      jokerApplied: false,
    })
  })

  it('doubles the whole matchweek with a Joker, not one fixture', () => {
    expect(scoreMatchweek(fixtures, true)).toEqual({
      basePoints: 8,
      totalPoints: 16,
      jokerApplied: true,
    })
  })

  it('doubles a reduced matchweek after a fixture reassignment', () => {
    // A departing fixture does not carry the Joker with it (ADR 0020): the
    // Joker keeps doubling whatever the remaining fixtures earn.
    expect(scoreMatchweek(fixtures.slice(0, 2), true).totalPoints).toBe(16)
    expect(scoreMatchweek([], true).totalPoints).toBe(0)
  })
})

describe('Joker allowance derives from the configured season shape', () => {
  it('is ten per season, five per half', () => {
    expect(SEASON_JOKERS_PER_SEASON).toBe(10)
    expect(SEASON_JOKERS_PER_HALF).toBe(5)
  })

  it('puts the half boundary at matchweek 19 for a 38-round season', () => {
    expect(seasonJokerAllowance(38)).toEqual({
      perSeason: 10,
      perHalf: 5,
      firstHalfLastMatchweek: 19,
      matchweekCount: 38,
    })
  })

  it('derives the boundary for a 33-round known calendar without assuming 38', () => {
    // Scottish Premiership handling: the initially known calendar is 33
    // rounds; the boundary comes from that configured count, not from the
    // league split and not from the Premier League's shape.
    expect(seasonJokerAllowance(33)?.firstHalfLastMatchweek).toBe(16)
  })

  it('fails closed on an invalid season shape', () => {
    expect(seasonJokerAllowance(0)).toBeNull()
    expect(seasonJokerAllowance(1)).toBeNull()
    expect(seasonJokerAllowance(38.5)).toBeNull()
    expect(seasonJokerAllowance(Number.NaN)).toBeNull()
  })
})

describe('Joker usage validation', () => {
  it('accepts five per half with no duplicates', () => {
    expect(validateJokerUsage([1, 5, 9, 14, 19, 20, 25, 30, 34, 38], 38)).toEqual({ valid: true })
  })

  it('rejects two Jokers on one matchweek', () => {
    expect(validateJokerUsage([7, 7], 38)).toEqual({
      valid: false,
      reason: 'more_than_one_per_matchweek',
    })
  })

  it('rejects a sixth first-half Joker: unused ones never carry, so halves cap independently', () => {
    expect(validateJokerUsage([1, 2, 3, 4, 5, 6], 38)).toEqual({
      valid: false,
      reason: 'first_half_allowance_exceeded',
    })
    expect(validateJokerUsage([20, 21, 22, 23, 24, 25], 38)).toEqual({
      valid: false,
      reason: 'second_half_allowance_exceeded',
    })
  })

  it('rejects out-of-range matchweeks and invalid shapes', () => {
    expect(validateJokerUsage([0], 38)).toEqual({ valid: false, reason: 'matchweek_out_of_range' })
    expect(validateJokerUsage([39], 38)).toEqual({ valid: false, reason: 'matchweek_out_of_range' })
    expect(validateJokerUsage([1], 1)).toEqual({ valid: false, reason: 'invalid_season_shape' })
  })

  it('caps the halves for a 33-round season at its own boundary', () => {
    // Matchweek 17 is second-half in a 33-round season (boundary 16).
    expect(validateJokerUsage([17, 18, 19, 20, 21, 22], 33)).toEqual({
      valid: false,
      reason: 'second_half_allowance_exceeded',
    })
    expect(validateJokerUsage([11, 12, 13, 14, 15, 16], 33)).toEqual({
      valid: false,
      reason: 'first_half_allowance_exceeded',
    })
  })
})

describe('authority separation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/domain/season/scoring.ts'),
    'utf8',
  )

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no ambient clock or zone', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
