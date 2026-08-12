import { explainFixtureScore, SEASON_PREDICTOR_POINTS } from '../../domain/season/scoring'
import type { MatchPredictorFixture } from './matchPredictorModel'

/**
 * `INNOV-014` — how close a settled matchweek came to being worth more.
 *
 * IT IS EXPLICITLY HYPOTHETICAL AND SAYS SO IN EVERY SENTENCE. The official
 * points for the matchweek are the server's and are untouched; this describes
 * what a different scoreline WOULD have been worth, under a condition it states
 * out loud. Nothing here rewrites a total, a rank or a history.
 *
 * ONLY OVER SETTLED FIXTURES. A fixture with no confirmed result has no miss to
 * measure, and measuring one against a provider's provisional score would be a
 * hypothetical built on a hypothetical.
 *
 * THE POINTS DIFFERENCE COMES FROM THE SCORING AUTHORITY, not from a constant
 * typed here: what an exact score is worth is `SEASON_PREDICTOR_POINTS`, and
 * what the prediction actually earned is `explainFixtureScore`'s. The
 * arithmetic is the subtraction of two numbers the authority produced.
 *
 * IT NEVER APPLIES A JOKER. The Joker doubles a whole matchweek and belongs to
 * the server's total; doubling a hypothetical fixture difference would produce
 * a figure that agrees with nothing.
 *
 * PURE.
 */

export type ClosestMiss = {
  fixtureId: string
  home: string
  away: string
  prediction: string
  result: string
  /** Total goals wrong across the two sides. 1 is "one goal away". */
  goalsOut: number
  /** What the prediction earned, from the authority. */
  pointsEarned: number
  /** What an exact score would have earned it instead. */
  pointsIfExact: number
  /** `pointsIfExact - pointsEarned`. Always positive; an exact score is excluded. */
  pointsMissed: number
  /** One sentence, stated as a hypothetical. */
  line: string
}

export type ClosestMissView = {
  /** Settled fixtures on the card the player actually predicted. */
  measured: number
  /** Misses of one or two goals, nearest first. Bounded by the caller. */
  misses: readonly ClosestMiss[]
  /** Total points the near misses would have added. Hypothetical, never banked. */
  pointsMissed: number
}

/**
 * How far out a prediction can be and still count as a near miss.
 *
 * TWO GOALS, not five: "you were nine goals away from an exact score" is not a
 * near miss, it is a wrong prediction described flatteringly, and a surface
 * full of those stops meaning anything.
 */
export const NEAR_MISS_GOALS = 2

/** At most this many misses are listed. A card of ten is a list, not a story. */
export const MAX_MISSES = 3

const label = (score: { home: number; away: number }): string => `${score.home} – ${score.away}`

export function presentClosestMisses(
  fixtures: readonly MatchPredictorFixture[],
): ClosestMissView {
  const settled = fixtures.filter(
    (fixture) => fixture.result !== null && fixture.prediction !== null,
  )

  const misses = settled.flatMap((fixture) => {
    const prediction = fixture.prediction
    const result = fixture.result
    if (!prediction || !result) return []

    const goalsOut =
      Math.abs(prediction.home - result.home) + Math.abs(prediction.away - result.away)
    // An exact score is not a miss, and anything beyond the threshold is not a
    // near one.
    if (goalsOut === 0 || goalsOut > NEAR_MISS_GOALS) return []

    const earned = explainFixtureScore(prediction, result).points
    const missed = SEASON_PREDICTOR_POINTS.exactScore - earned
    if (missed <= 0) return []

    return [
      {
        fixtureId: fixture.fixtureId,
        home: fixture.home.name,
        away: fixture.away.name,
        prediction: label(prediction),
        result: label(result),
        goalsOut,
        pointsEarned: earned,
        pointsIfExact: SEASON_PREDICTOR_POINTS.exactScore,
        pointsMissed: missed,
        line:
          goalsOut === 1
            ? `One goal from an exact score. It would have been worth ${missed} more.`
            : `Two goals from an exact score. It would have been worth ${missed} more.`,
      } satisfies ClosestMiss,
    ]
  })

  const ordered = [...misses].sort((left, right) => {
    if (left.goalsOut !== right.goalsOut) return left.goalsOut - right.goalsOut
    if (left.pointsMissed !== right.pointsMissed) return right.pointsMissed - left.pointsMissed
    // A stated final order so two renders cannot disagree. It ranks nothing.
    return left.fixtureId.localeCompare(right.fixtureId)
  })

  return {
    measured: settled.length,
    misses: ordered.slice(0, MAX_MISSES),
    // Over EVERY near miss rather than the three shown: the headline is about
    // the matchweek, and totalling only the visible rows would understate it.
    pointsMissed: ordered.reduce((sum, miss) => sum + miss.pointsMissed, 0),
  }
}
