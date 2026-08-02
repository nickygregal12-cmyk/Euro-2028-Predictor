/**
 * Domestic season Main Predictor scoring authority.
 *
 * Authority: ADR 0012 as amended by ADR 0020. This module is deliberately
 * separate from the tournament scoring implementation and imports nothing
 * from `src/domain/tournament/` — the values coincide today (exact 5,
 * result 3) because ADR 0012 chose to keep them, not because one authority
 * serves both. Do not merge them for convenience.
 *
 * Binding rules encoded here:
 * - score predictions only; an exact score REPLACES correct-result points
 *   rather than adding to them;
 * - a missing prediction scores zero;
 * - the Joker doubles the WHOLE matchweek's points, never one fixture;
 * - ten whole-matchweek Jokers per season, five per half, no carry-over,
 *   at most one per matchweek;
 * - the half boundary is derived from the configured matchweek count —
 *   never a hard-coded 19, and never tied to the Scottish league split.
 */

export const SEASON_PREDICTOR_POINTS = {
  exactScore: 5,
  correctResult: 3,
} as const

export const SEASON_JOKERS_PER_SEASON = 10
export const SEASON_JOKERS_PER_HALF = 5

export type ScorelinePrediction = {
  home: number
  away: number
}

export type FixtureFinalScore = {
  home: number
  away: number
}

function isValidScoreline(value: ScorelinePrediction | FixtureFinalScore | null | undefined): value is ScorelinePrediction {
  return (
    value != null &&
    Number.isInteger(value.home) &&
    Number.isInteger(value.away) &&
    value.home >= 0 &&
    value.away >= 0
  )
}

function outcomeOf(score: ScorelinePrediction): 'home' | 'away' | 'draw' {
  if (score.home > score.away) return 'home'
  if (score.home < score.away) return 'away'
  return 'draw'
}

/**
 * Points for one settled fixture. Exact score is 5 total — it replaces the
 * correct-result 3, it does not stack. A missing or malformed prediction, or
 * an invalid result, scores zero: unknown data never awards points.
 */
export function scoreFixture(
  prediction: ScorelinePrediction | null | undefined,
  result: FixtureFinalScore,
): number {
  if (!isValidScoreline(result) || !isValidScoreline(prediction)) return 0
  if (prediction.home === result.home && prediction.away === result.away) {
    return SEASON_PREDICTOR_POINTS.exactScore
  }
  if (outcomeOf(prediction) === outcomeOf(result)) {
    return SEASON_PREDICTOR_POINTS.correctResult
  }
  return 0
}

export type SettledMatchweekFixture = {
  prediction: ScorelinePrediction | null
  result: FixtureFinalScore
}

export type MatchweekScore = {
  /** Sum of per-fixture points before any Joker. */
  basePoints: number
  /** Base points, doubled when the matchweek Joker applies. */
  totalPoints: number
  jokerApplied: boolean
}

/**
 * Points for a whole matchweek's settled fixtures. The Joker doubles the
 * matchweek total — including a reduced fixture set after a reassignment,
 * because the Joker attaches to the matchweek and never follows a departing
 * fixture (ADR 0020).
 */
export function scoreMatchweek(
  fixtures: readonly SettledMatchweekFixture[],
  jokerApplied: boolean,
): MatchweekScore {
  const basePoints = fixtures.reduce(
    (sum, fixture) => sum + scoreFixture(fixture.prediction, fixture.result),
    0,
  )
  return {
    basePoints,
    totalPoints: jokerApplied ? basePoints * 2 : basePoints,
    jokerApplied,
  }
}

export type SeasonJokerAllowance = {
  perSeason: number
  perHalf: number
  /** The last matchweek of the first half, derived from the season shape. */
  firstHalfLastMatchweek: number
  matchweekCount: number
}

/**
 * The Joker allowance for a configured season shape, or `null` when the
 * shape is invalid — callers must fail closed on `null`, not assume 38.
 *
 * The half boundary is `floor(count / 2)`: 19 for a 38-round season, 16 for
 * a 33-round known calendar. It is a property of the configured structure
 * only — deliberately not the SPFL post-split phase.
 */
export function seasonJokerAllowance(matchweekCount: number): SeasonJokerAllowance | null {
  if (!Number.isInteger(matchweekCount) || matchweekCount < 2) return null
  return {
    perSeason: SEASON_JOKERS_PER_SEASON,
    perHalf: SEASON_JOKERS_PER_HALF,
    firstHalfLastMatchweek: Math.floor(matchweekCount / 2),
    matchweekCount,
  }
}

export type JokerUsageVerdict =
  | { valid: true }
  | {
      valid: false
      reason:
        | 'invalid_season_shape'
        | 'matchweek_out_of_range'
        | 'more_than_one_per_matchweek'
        | 'first_half_allowance_exceeded'
        | 'second_half_allowance_exceeded'
    }

/**
 * Whether a set of Joker matchweeks is legal for the season shape. Unused
 * first-half Jokers do not carry forward, which is why each half is capped
 * independently rather than the season being capped at ten alone.
 */
export function validateJokerUsage(
  jokerMatchweeks: readonly number[],
  matchweekCount: number,
): JokerUsageVerdict {
  const allowance = seasonJokerAllowance(matchweekCount)
  if (allowance === null) return { valid: false, reason: 'invalid_season_shape' }

  const seen = new Set<number>()
  let firstHalfUsed = 0
  let secondHalfUsed = 0
  for (const matchweek of jokerMatchweeks) {
    if (!Number.isInteger(matchweek) || matchweek < 1 || matchweek > matchweekCount) {
      return { valid: false, reason: 'matchweek_out_of_range' }
    }
    if (seen.has(matchweek)) return { valid: false, reason: 'more_than_one_per_matchweek' }
    seen.add(matchweek)
    if (matchweek <= allowance.firstHalfLastMatchweek) firstHalfUsed += 1
    else secondHalfUsed += 1
  }
  if (firstHalfUsed > allowance.perHalf) return { valid: false, reason: 'first_half_allowance_exceeded' }
  if (secondHalfUsed > allowance.perHalf) return { valid: false, reason: 'second_half_allowance_exceeded' }
  return { valid: true }
}
