import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  calculateScore,
  type MatchScorePrediction,
  type MatchScoreResult,
} from '../../src/domain/tournament/calculateScore'
import { JOKER_MULTIPLIER } from '../../src/domain/tournament/scoringConfig'

const score = fc.integer({ min: 0, max: 12 })

const matchRows = fc.array(
  fc.tuple(score, score, score, score, fc.boolean()),
  { maxLength: 24 },
)

function matches(rows: readonly [number, number, number, number, boolean][]): {
  predictions: MatchScorePrediction[]
  results: MatchScoreResult[]
} {
  return {
    predictions: rows.map(([home, away, _actualHome, _actualAway, joker], index) => ({
      matchId: `m-${index}`,
      homeScore: home,
      awayScore: away,
      joker,
    })),
    results: rows.map(([_home, _away, actualHome, actualAway], index) => ({
      matchId: `m-${index}`,
      homeScore: actualHome,
      awayScore: actualAway,
    })),
  }
}

describe('calculateScore properties', () => {
  it('always reports a total equal to the sum of its independently explained sections', () => {
    fc.assert(
      fc.property(matchRows, (rows) => {
        const { predictions, results } = matches(rows)
        const scored = calculateScore(
          { groupMatches: predictions },
          { groupMatches: results },
        )

        expect(scored.total).toBe(
          scored.groupMatches.total +
            scored.groupOrders.total +
            scored.knockout.total +
            scored.bonus.total,
        )
      }),
      { numRuns: 500 },
    )
  })

  it('is deterministic and never produces negative points for valid non-negative scores', () => {
    fc.assert(
      fc.property(matchRows, (rows) => {
        const { predictions, results } = matches(rows)
        const input = { groupMatches: predictions }
        const actuals = { groupMatches: results }

        const first = calculateScore(input, actuals)
        const second = calculateScore(input, actuals)

        expect(second).toEqual(first)
        expect(first.total).toBeGreaterThanOrEqual(0)
        expect(first.groupMatches.items.every((item) => item.points >= 0)).toBe(true)
      }),
      { numRuns: 500 },
    )
  })

  it('does not change a score when an unrelated unresolved fixture is added', () => {
    fc.assert(
      fc.property(matchRows, score, score, (rows, homeScore, awayScore) => {
        const { predictions, results } = matches(rows)
        const baseline = calculateScore(
          { groupMatches: predictions },
          { groupMatches: results },
        )
        const withUnresolved = calculateScore(
          {
            groupMatches: [
              ...predictions,
              {
                matchId: `unresolved-${rows.length}`,
                homeScore,
                awayScore,
              },
            ],
          },
          { groupMatches: results },
        )

        expect(withUnresolved).toEqual(baseline)
      }),
      { numRuns: 500 },
    )
  })

  it('applies the joker multiplier only to an otherwise identical exact-match score', () => {
    fc.assert(
      fc.property(score, score, (homeScore, awayScore) => {
        const result = [{ matchId: 'm', homeScore, awayScore }]
        const plain = calculateScore(
          { groupMatches: [{ matchId: 'm', homeScore, awayScore }] },
          { groupMatches: result },
        )
        const joker = calculateScore(
          { groupMatches: [{ matchId: 'm', homeScore, awayScore, joker: true }] },
          { groupMatches: result },
        )

        expect(joker.groupMatches.total).toBe(
          plain.groupMatches.total * JOKER_MULTIPLIER,
        )
        expect(joker.groupOrders.total).toBe(plain.groupOrders.total)
        expect(joker.knockout.total).toBe(plain.knockout.total)
        expect(joker.bonus.total).toBe(plain.bonus.total)
      }),
      { numRuns: 500 },
    )
  })
})
