/**
 * vNext SEASON WRAPPED — a finished season, exactly as the archive recorded it.
 *
 * ============================ IT IS A SNAPSHOT, NOT A DERIVATION =========
 *
 * Contract 156's `season_wrapped` row is written once, when the season has
 * ENDED, and is immutable by trigger. That is the whole reason this surface can
 * exist: a Wrapped that changed because a scoring formula changed would be a
 * different season every time it was opened, which is the one thing an archive
 * may not be.
 *
 * So nothing here is computed from anything else. The two rates below divide
 * two stored numbers and are the ONLY arithmetic on this page; they come from
 * the service's own helpers rather than being re-implemented, and there is no
 * percentile, because a percentile worked out in a browser from a rank and a
 * field size is a number the archive never agreed to.
 *
 * ============================ AND "NOT YET" IS AN ANSWER =================
 *
 * A season still running has no Wrapped. `pending` is a real, common state and
 * a fair question fairly answered — never an error, and never a snapshot of
 * zeros, because a season showing "0 points, rank 0" is a lie about a season
 * the player may currently be winning.
 *
 * `finished-unwrapped` is the third state and it is not the same as either. A
 * season can be over while its archive row has not been written; contract 161
 * treats those as independent facts and this model does too, because telling a
 * player their season is still running is exactly the defect that separation
 * exists to prevent.
 */

type SeasonWrappedTotals = {
  readonly points: number
  /**
   * Null where the snapshot holds no rank.
   *
   * NOT A ZERO AND NOT A LAST PLACE. "We do not know where you finished" and
   * "you finished nowhere" are different sentences and only one is printable.
   */
  readonly rank: number | null
  readonly fieldSize: number | null
  readonly matchweeksPlayed: number
}

type SeasonWrappedBest = {
  readonly ordinal: number
  readonly points: number
}

type SeasonWrappedAccuracy = {
  readonly fixturesPredicted: number
  readonly exactScores: number
  readonly correctOutcomes: number
  /**
   * Exact scores as a share of what was actually predicted, 0–1, or null where
   * nothing was predicted. Stated by the mapper from the service's own helper,
   * so a season somebody entered and never played prints no percentage rather
   * than `NaN%` or a confident zero.
   */
  readonly exactShare: number | null
  readonly correctShare: number | null
}

export type SeasonWrappedResult = {
  readonly season: SeasonWrappedTotals
  /** Null when the player banked nothing all season. */
  readonly best: SeasonWrappedBest | null
  readonly accuracy: SeasonWrappedAccuracy
  readonly jokersPlayed: number
  /** ISO 8601, or null where the archive did not stamp one. */
  readonly finalisedAt: string | null
}

/**
 * What the page is showing, and every one of these is a real answer.
 *
 * `unavailable` is the only one that is a failure, and it is separate from
 * `pending` on purpose: "your season is still going" and "we could not read
 * your season" send a player to different places.
 */
export type SeasonWrappedBody =
  | { readonly kind: 'wrapped'; readonly result: SeasonWrappedResult }
  | { readonly kind: 'pending' }
  | { readonly kind: 'unavailable' }

type SeasonWrappedContext = {
  readonly competitionName: string
  readonly seasonLabel: string
  readonly playerName: string | null
}

export type SeasonWrappedModel = {
  /** The instant the model describes. Components take "now" as an input. */
  readonly generatedAt: string
  readonly context: SeasonWrappedContext
  readonly body: SeasonWrappedBody
}

/**
 * Whether the player predicted anything at all.
 *
 * A SEASON SOMEBODY ENTERED AND NEVER PLAYED IS A REAL WRAPPED, and it needs a
 * different page rather than a grid of zeros: no rates, no best matchweek, and
 * a sentence saying so. Read from the archive's own count, never inferred from
 * points being zero — a player can predict a full season and score nothing.
 */
export function wrappedIsEmpty(result: SeasonWrappedResult): boolean {
  return result.accuracy.fixturesPredicted === 0
}
