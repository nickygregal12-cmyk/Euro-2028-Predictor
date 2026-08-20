import type { CardPresentation, MatchPredictorPage } from '../../../features/season/matchPredictorModel'
import type { WeekAction } from '../../../features/hub/competitionWeekModel'
import type { SeasonListFixture } from '../../../services/supabase/seasonFixtureListModel'
import type { SeasonClubFormTable } from '../../../services/supabase/seasonClubFormModel'
import type { SeasonConsensus } from '../../../services/supabase/seasonConsensusModel'
import type { SeasonMatchweekProjection } from '../../../services/supabase/seasonMatchweekProjectionModel'
import type { SeasonPlayerProfile } from '../../../services/supabase/seasonPlayerProfileModel'
import type { SeasonLeagueStandingsPage } from '../../../services/supabase/seasonLeagueStandingsModel'
import type { SeasonLeagueMovement } from '../../../services/supabase/seasonLeagueMovementModel'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT HOME.
 *
 * This is the ONE boundary between the running product and the Gold Standard
 * Home. Everything below arrives from an existing read that already owns its
 * truth; nothing here is a rule, and nothing here is shaped by what Home wants
 * to draw. `buildHomeModel` turns this into a `HomeModel` and is pure, so this
 * type is also the entire test surface for the mapping.
 *
 * WHY IT CARRIES READ MODELS RATHER THAN A FLATTENED SHAPE. A flattened source
 * would need somebody to decide, here, which fields matter — and that decision
 * would be the mapping happening twice, once in the acquisition hook and once in
 * the mapper. Handing over each read's own presentation model keeps the mapper
 * the only thing that knows what Home shows, and keeps every field traceable to
 * the contract that answered it.
 *
 * EVERY SECONDARY READ IS NULLABLE, AND THAT IS THE DEGRADATION MODEL. Home is
 * assembled from one required core — a competition context and its fixtures —
 * plus enrichments that each fail on their own. A failed club-form read costs
 * Home its form strings and nothing else; a failed consensus read costs it a
 * consensus bar. `null` means "this read did not answer", is never a value, and
 * never fails the page.
 *
 * NOTHING HERE IS A CLOCK. `generatedAt` is supplied by the caller, exactly as
 * the workshop fixtures supply it, so the mapper is deterministic and a test can
 * pin an instant. A mapper that read `Date.now()` would make every assertion
 * about it time-dependent, and would quietly become the thing §18 forbids: a
 * presentation layer deciding what "now" means about a football match.
 */

/** The user, as the existing auth authority states them. */
type HomeSourceUser = {
  readonly id: string
  readonly displayName: string | null
}

/**
 * Which competition season Home is showing, from `get_season_play_context`.
 *
 * `matchweek` is the matchweek that read OPENS ON, which is the application's
 * own answer to "which matchweek is current". Home does not pick one.
 */
type HomeSourceCompetition = {
  readonly tournamentId: string
  readonly name: string
  readonly seasonLabel: string
  readonly matchweek: number | null
  readonly matchweekCount: number
}

/** One private league, with whatever of its table and movement was readable. */
export type HomeSourceLeague = {
  readonly id: string
  readonly name: string
  readonly memberCount: number
  readonly standings: SeasonLeagueStandingsPage
  /**
   * Contract 150, and only ever for a SETTLED matchweek. Null where the read
   * failed, was not asked, or answered `settled: false` — a matchweek still
   * being scored has moved nobody yet.
   */
  readonly movement: SeasonLeagueMovement | null
}

export type HomeSource = {
  /**
   * The instant the model describes, supplied rather than read. Every formatted
   * relative time in Home is measured against this.
   */
  readonly generatedAt: string
  readonly user: HomeSourceUser
  readonly competition: HomeSourceCompetition

  /**
   * Contract 139's fixture window: kickoff, the server's status, the official
   * result, the provider's live state, and both clubs' identity tokens.
   *
   * THIS IS THE ONLY SOURCE OF FOOTBALL STATUS. Whether a match is live, played
   * or postponed is read from here and never worked out from a kickoff instant.
   */
  readonly fixtures: readonly SeasonListFixture[]

  /**
   * The player's own matchweek card: their predictions, the resolved lock and
   * the matchweek's banked points. Null where the player holds no entry, or the
   * read failed.
   */
  readonly card: MatchPredictorPage | null

  /**
   * `presentCard`'s answer for that card — crucially `editable`, which is the
   * application's authority on whether a prediction may be changed.
   *
   * IT IS PASSED IN RATHER THAN COMPUTED HERE so the mapper cannot be tempted
   * to reach for `card.lock` and decide for itself.
   */
  readonly cardPresentation: CardPresentation | null

  /**
   * The Hub's own answer to "what does this player need to do this week?", for
   * the Match Predictor. Null where the week model produced no action.
   */
  readonly weekAction: WeekAction | null

  /** Contract 151 over the caller themselves: points, rank, field size, accuracy, history. */
  readonly profile: SeasonPlayerProfile | null

  /** Private leagues, capped by the caller. Empty is an ordinary state. */
  readonly leagues: readonly HomeSourceLeague[]

  /** Contract 141's settled-fixture club form. Null where unread. */
  readonly clubForm: SeasonClubFormTable | null

  /**
   * Contract 130's consensus, which the server HIDES before the matchweek locks.
   * Null covers both "not readable" and "not permitted yet", and the mapper
   * treats them identically: no consensus is shown.
   */
  readonly consensus: SeasonConsensus | null

  /**
   * Contract 175's projection — the only authority that states, per fixture,
   * whether a point value rests on an official result or a provider opinion.
   * Null where unread or refused.
   */
  readonly projection: SeasonMatchweekProjection | null

  /**
   * When this DEVICE last showed the player their Home, if it ever has.
   *
   * THE ONE FIELD HERE THAT IS NOT THE APPLICATION'S. Every other source field
   * is a read the server answered; this is a local marker, and it is what
   * "since you were last here" is measured from. The direction accepted that
   * shape for a first release — a server cursor for cross-device continuity is
   * a later contract — and the cost is stated where the marker is written: a
   * player who reads the results on their phone still sees them on a laptop.
   *
   * IT DECIDES NOTHING. It selects which already-settled results to show first.
   * A wrong or missing value makes Home show more or less recent football and
   * can never make it show something untrue, which is why a local value is
   * allowed to reach a mapper that otherwise refuses anything but a read.
   *
   * OPTIONAL, so a caller that has no marker — a story, a test, the workshop —
   * simply omits it and gets no zone.
   */
  readonly lastVisitAt?: string | null

  /**
   * The rivals this player has chosen to watch in this competition (contract
   * 157), from the shell's own preference read.
   *
   * IT LEADS THE RIVAL LIST rather than adding a zone. Home already answers
   * "who am I racing" from league adjacency; a pin says which of those answers
   * the player actually cares about, which is a better ordering of the same
   * question rather than a second question.
   *
   * Absent is the ordinary state, and is what an unread preference produces.
   */
  readonly watchedRivalIds?: readonly string[] | undefined
}
