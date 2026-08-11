/**
 * A finished season, as the archive recorded it (contract 156, `MIG-UI-08`).
 *
 * IT IS A SNAPSHOT, NOT A DERIVATION, AND THE DIFFERENCE IS THE WHOLE POINT.
 * `season_wrapped` is written once, when the season has ENDED, is immutable by
 * trigger, and stores facts rather than presentation. Nothing in the browser may
 * recompute any of these numbers: a Wrapped that changed because a UI formula
 * changed would be a different season every time it was opened.
 *
 * `finalised: false` IS THE COMMON CASE AND A REAL ANSWER. A season that is
 * still running has no Wrapped, and the player asking is asking a fair question.
 * It is not an error, not an empty snapshot, and must never be rendered as
 * zeros — a season showing "0 points, rank 0" would be a lie about a season the
 * player is currently winning.
 *
 * WHAT IT DOES NOT CARRY, AND IS NOT FAKED. The requirement's full wish list
 * includes percentile, rank journey, biggest climb, streaks, club outcomes,
 * private-league finishes and trophies. Contract 156 stores the subset below and
 * no more, so the presentation shows that subset and no more. There is no
 * derived percentile here, because a percentile computed in the browser from
 * `rank` and `fieldSize` would be a number the archive never agreed to.
 *
 * PURE. No clock, no network, no storage.
 */

export type SeasonWrappedTotals = {
  points: number
  rank: number | null
  fieldSize: number | null
  matchweeksPlayed: number
}

export type SeasonWrappedBestMatchweek = {
  ordinal: number
  points: number
}

export type SeasonWrappedAccuracy = {
  fixturesPredicted: number
  exactScores: number
  correctOutcomes: number
}

export type SeasonWrapped =
  | { finalised: false }
  | {
      finalised: true
      season: SeasonWrappedTotals
      /** Null when the player banked nothing all season. */
      bestMatchweek: SeasonWrappedBestMatchweek | null
      accuracy: SeasonWrappedAccuracy
      jokersPlayed: number
      finalisedAt: string | null
    }

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function countOf(value: unknown): number {
  const parsed = integerOrNull(value)
  return parsed !== null && parsed >= 0 ? parsed : 0
}

export function mapSeasonWrapped(payload: unknown): SeasonWrapped {
  const root = objectOf(payload)
  if (root.finalised !== true) return { finalised: false }

  const season = objectOf(root.season)
  const accuracy = objectOf(root.accuracy)
  const best = root.best_matchweek === null ? null : objectOf(root.best_matchweek)
  const bestOrdinal = best ? integerOrNull(best.ordinal) : null
  const bestPoints = best ? integerOrNull(best.points) : null

  return {
    finalised: true,
    season: {
      points: countOf(season.points),
      // Rank and field size stay nullable rather than defaulting to zero: "we
      // do not know where you finished" and "you finished nowhere" are not the
      // same sentence, and only one of them is printable.
      rank: integerOrNull(season.rank),
      fieldSize: integerOrNull(season.field_size),
      matchweeksPlayed: countOf(season.matchweeks_played),
    },
    bestMatchweek:
      bestOrdinal !== null && bestPoints !== null
        ? { ordinal: bestOrdinal, points: bestPoints }
        : null,
    accuracy: {
      fixturesPredicted: countOf(accuracy.fixtures_predicted),
      exactScores: countOf(accuracy.exact_scores),
      correctOutcomes: countOf(accuracy.correct_outcomes),
    },
    jokersPlayed: countOf(root.jokers_played),
    finalisedAt: stringOrNull(root.finalised_at),
  }
}

/**
 * Exact-score share of the fixtures the player actually predicted.
 *
 * PRESENTATION ARITHMETIC OVER STORED FACTS, and deliberately nothing more. It
 * divides two numbers the archive stored; it does not rank, score, or place the
 * player against anybody. Null when nothing was predicted, so a Wrapped for a
 * season somebody entered and never played prints no percentage rather than
 * `NaN%` or a confident zero.
 */
export function exactScoreRate(accuracy: SeasonWrappedAccuracy): number | null {
  if (accuracy.fixturesPredicted <= 0) return null
  return accuracy.exactScores / accuracy.fixturesPredicted
}

export function correctOutcomeRate(accuracy: SeasonWrappedAccuracy): number | null {
  if (accuracy.fixturesPredicted <= 0) return null
  return accuracy.correctOutcomes / accuracy.fixturesPredicted
}
