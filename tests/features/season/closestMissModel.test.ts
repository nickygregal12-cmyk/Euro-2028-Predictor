import { describe, expect, it } from 'vitest'
import {
  MAX_MISSES,
  NEAR_MISS_GOALS,
  presentClosestMisses,
} from '../../../src/features/season/closestMissModel'
import type { MatchPredictorFixture } from '../../../src/features/season/matchPredictorModel'
import { SEASON_PREDICTOR_POINTS } from '../../../src/domain/season/scoring'

/**
 * `INNOV-014`. Every figure must be a conditional derived from the scoring
 * authority, and nothing may be measured against a fixture that has no
 * confirmed result.
 */

const club = (name: string) => ({
  name,
  shortName: name.slice(0, 3).toUpperCase(),
  tokens: { monogram: name.slice(0, 3).toUpperCase(), primary: '#000000' },
})

function fixtureOf(
  id: string,
  prediction: { home: number; away: number } | null,
  result: { home: number; away: number } | null,
): MatchPredictorFixture {
  return {
    fixtureId: id,
    kickoffAt: '2026-08-15T14:00:00Z',
    home: club(`Home${id}`),
    away: club(`Away${id}`),
    prediction,
    result,
    points: null,
  }
}

describe('presentClosestMisses', () => {
  it('measures nothing on a fixture with no confirmed result', () => {
    const view = presentClosestMisses([fixtureOf('a', { home: 2, away: 1 }, null)])
    expect(view.measured).toBe(0)
    expect(view.misses).toEqual([])
  })

  it('measures nothing where the player did not predict', () => {
    const view = presentClosestMisses([fixtureOf('a', null, { home: 2, away: 1 })])
    expect(view.measured).toBe(0)
  })

  it('excludes an exact score, which is not a miss', () => {
    const view = presentClosestMisses([
      fixtureOf('a', { home: 2, away: 1 }, { home: 2, away: 1 }),
    ])
    expect(view.misses).toEqual([])
    expect(view.measured).toBe(1)
  })

  it('reports a one-goal miss with the points the authority says it cost', () => {
    // 2-1 against 3-1: right result, wrong score. It earned 3 and an exact
    // score is worth 5, so two points were the difference.
    const view = presentClosestMisses([
      fixtureOf('a', { home: 2, away: 1 }, { home: 3, away: 1 }),
    ])
    const miss = view.misses[0]
    expect(miss?.goalsOut).toBe(1)
    expect(miss?.pointsEarned).toBe(SEASON_PREDICTOR_POINTS.correctResult)
    expect(miss?.pointsIfExact).toBe(SEASON_PREDICTOR_POINTS.exactScore)
    expect(miss?.pointsMissed).toBe(2)
    expect(miss?.line).toContain('One goal from an exact score')
  })

  it('reports a wrong result that was still close, with the larger difference', () => {
    // 1-0 against 0-1: two goals out, and it earned nothing.
    const view = presentClosestMisses([
      fixtureOf('a', { home: 1, away: 0 }, { home: 0, away: 1 }),
    ])
    expect(view.misses[0]?.goalsOut).toBe(2)
    expect(view.misses[0]?.pointsMissed).toBe(SEASON_PREDICTOR_POINTS.exactScore)
  })

  it('ignores a prediction well outside the near-miss threshold', () => {
    const view = presentClosestMisses([
      fixtureOf('a', { home: 0, away: 0 }, { home: 4, away: 0 }),
    ])
    expect(NEAR_MISS_GOALS).toBe(2)
    expect(view.misses).toEqual([])
  })

  it('orders nearest first and bounds the list', () => {
    const view = presentClosestMisses([
      fixtureOf('a', { home: 1, away: 0 }, { home: 0, away: 1 }),
      fixtureOf('b', { home: 2, away: 1 }, { home: 3, away: 1 }),
      fixtureOf('c', { home: 0, away: 0 }, { home: 0, away: 1 }),
      fixtureOf('d', { home: 1, away: 1 }, { home: 2, away: 1 }),
    ])
    expect(view.misses).toHaveLength(MAX_MISSES)
    expect(view.misses[0]?.goalsOut).toBe(1)
    expect(view.misses.map((miss) => miss.goalsOut)).toEqual([1, 1, 1])
  })

  it('totals every near miss rather than only the ones it shows', () => {
    const view = presentClosestMisses([
      fixtureOf('a', { home: 1, away: 0 }, { home: 0, away: 1 }),
      fixtureOf('b', { home: 2, away: 1 }, { home: 3, away: 1 }),
      fixtureOf('c', { home: 0, away: 0 }, { home: 0, away: 1 }),
      fixtureOf('d', { home: 1, away: 1 }, { home: 2, away: 1 }),
    ])
    // 5 + 2 + 5 + 5 = 17 across four near misses, three of which are listed.
    // Only 'b' called the right result, so only 'b' earned anything at all.
    expect(view.pointsMissed).toBe(17)
  })
})
