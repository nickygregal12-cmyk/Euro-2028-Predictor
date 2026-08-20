import type { SeasonWrapped } from '../../../services/supabase/seasonWrappedModel'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT SEASON WRAPPED.
 *
 *   contract 156  `get_season_wrapped`        the immutable archive row
 *   contract 130  `get_season_play_context`   which competition and season
 *
 * ============================ TWO KINDS OF ABSENCE, KEPT APART ===========
 *
 * `wrapped` carries the read's own answer, INCLUDING `{ finalised: false }`,
 * which is not an absence at all: it is the archive saying the season has not
 * ended. `null` here means the read did not answer, and the two produce
 * different pages — "your season is still going" and "we could not read your
 * season" send a player to different places.
 *
 * Collapsing them was the obvious shape and is the defect this type exists to
 * prevent.
 */
export type WrappedSource = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string
  readonly competitionName: string
  readonly seasonLabel: string
  /** The reader's own name, where the host has one. Null is ordinary. */
  readonly playerName: string | null
  /**
   * Contract 156's answer, or `null` where the read did not land.
   *
   * `{ finalised: false }` IS AN ANSWER AND IS NOT NULL. See above.
   */
  readonly wrapped: SeasonWrapped | null
}
