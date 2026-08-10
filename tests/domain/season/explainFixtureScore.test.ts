import { describe, expect, it } from 'vitest'
import {
  SEASON_PREDICTOR_POINTS,
  explainFixtureScore,
  scoreFixture,
} from '../../../src/domain/season/scoring'

/**
 * The reusable points explanation, and the parity that makes it safe.
 *
 * WHY THE PARITY TEST IS THE POINT. The direction requires one reusable
 * explanation driven by the canonical scoring authority, and forbids
 * recreating the rules in presentation code merely to explain them. The risk in
 * "return the reason as well as the points" is that the reason and the number
 * drift — an explanation saying "right result" beside a zero. Asserting the two
 * agree across every combination is what removes that risk permanently, rather
 * than a reviewer noticing.
 *
 * The grid is exhaustive over a realistic scoreline range, which is small
 * enough to enumerate and large enough to include every outcome pairing.
 */

const RANGE = [0, 1, 2, 3, 4] as const

describe('explainFixtureScore agrees with scoreFixture, always', () => {
  it('returns exactly scoreFixture’s points for every scoreline pairing', () => {
    let checked = 0
    for (const predictedHome of RANGE) {
      for (const predictedAway of RANGE) {
        for (const resultHome of RANGE) {
          for (const resultAway of RANGE) {
            const prediction = { home: predictedHome, away: predictedAway }
            const result = { home: resultHome, away: resultAway }
            expect(explainFixtureScore(prediction, result).points).toBe(
              scoreFixture(prediction, result),
            )
            checked += 1
          }
        }
      }
    }
    // Guard the guard: a loop that stopped iterating would pass silently.
    expect(checked).toBe(RANGE.length ** 4)
  })

  it('names the reason the points came from', () => {
    expect(explainFixtureScore({ home: 2, away: 1 }, { home: 2, away: 1 })).toEqual({
      reason: 'exact_score',
      points: SEASON_PREDICTOR_POINTS.exactScore,
    })
    expect(explainFixtureScore({ home: 3, away: 1 }, { home: 2, away: 1 })).toEqual({
      reason: 'correct_result',
      points: SEASON_PREDICTOR_POINTS.correctResult,
    })
    expect(explainFixtureScore({ home: 0, away: 2 }, { home: 2, away: 1 })).toEqual({
      reason: 'wrong',
      points: 0,
    })
  })

  it('separates “did not predict” from “predicted wrongly”', () => {
    // Both score nothing, and telling a player they predicted badly when they
    // did not predict at all is a different — and false — statement.
    expect(explainFixtureScore(null, { home: 1, away: 0 }).reason).toBe('unscored')
    expect(explainFixtureScore(undefined, { home: 1, away: 0 }).reason).toBe('unscored')
    expect(explainFixtureScore({ home: 0, away: 2 }, { home: 2, away: 1 }).reason).toBe('wrong')
  })

  it('treats a malformed scoreline as unscored rather than as a miss', () => {
    expect(
      explainFixtureScore({ home: -1, away: 0 }, { home: 1, away: 0 }).reason,
    ).toBe('unscored')
    expect(
      explainFixtureScore({ home: 1, away: 0 }, { home: 1.5, away: 0 }).reason,
    ).toBe('unscored')
  })

  it('reads its points from the shared configuration, not from literals', () => {
    // If ADR 0012's award ever changes, this test changes with the config
    // rather than pinning a number the authority no longer uses.
    const exact = explainFixtureScore({ home: 1, away: 1 }, { home: 1, away: 1 })
    expect(exact.points).toBe(SEASON_PREDICTOR_POINTS.exactScore)
  })
})
