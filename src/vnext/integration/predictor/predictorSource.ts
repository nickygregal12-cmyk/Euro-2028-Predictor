import type { SaveStatus } from '../../../domain/saveCoordinator'
import type {
  CardPresentation,
  MatchPredictorPage,
} from '../../../features/season/matchPredictorModel'
import type { SeasonClubFormTable } from '../../../services/supabase/seasonClubFormModel'
import type { CompetitionTableRow } from '../../../services/supabase/competitionTableModel'
import type { SeasonConsensus } from '../../../services/supabase/seasonConsensusModel'

/**
 * WHAT THE REAL APPLICATION HANDS THE vNEXT MATCH PREDICTOR.
 *
 * The second boundary of its kind, and deliberately the same shape as
 * `integration/home/homeSource.ts`: each field is some existing read's own
 * presentation model, nothing is reshaped to suit what the page wants to draw,
 * and `buildPredictorModel` is the only thing that knows what the page shows.
 * That split is what makes the mapping testable with no Supabase, no auth and no
 * network — and it is why this type is also the entire test surface for it.
 *
 * ONE REQUIRED CORE, AND IT IS THE CARD. Without the player's matchweek card
 * there is no predictor: no fixtures, no lock, no Joker, nothing to enter. So
 * `card` and `presentation` are non-nullable here and a failure of either is a
 * failure of the surface, which is the honest outcome — a predictor that quietly
 * drew an empty matchweek would tell a player there is nothing to do while a
 * deadline passed.
 *
 * EVERYTHING ELSE IS AN ENRICHMENT THAT FAILS ALONE. Club form, the competition
 * table and the consensus are each `null` on their own. A failed form read costs
 * the page its form strings and nothing else. `null` means "this read did not
 * answer", is never a value, and never fails the page.
 *
 * `presentation` IS PASSED IN RATHER THAN COMPUTED, exactly as it is on the Home
 * path and for the same reason: it is `presentCard(card, hasConflict)` — the
 * application's authority on whether a prediction may be edited — and handing the
 * mapper the ANSWER means the mapper cannot be tempted to reach for `card.lock`
 * and decide for itself.
 *
 * NOTHING HERE IS A CLOCK. `generatedAt` is supplied by the caller, so the mapper
 * is deterministic and a test can pin an instant. Every countdown on the page is
 * measured against it.
 */

export type PredictorSource = {
  /** The instant the model describes, supplied rather than read. */
  readonly generatedAt: string

  readonly competition: {
    readonly name: string
    readonly seasonLabel: string
    /** The season's own matchweek count, for "Matchweek 4 of 38". */
    readonly matchweekCount: number
  }

  /**
   * The player's matchweek card, from the existing Match Predictor gateway:
   * fixtures, club identity, their own predictions, official results, the
   * resolved lock, the Joker allowance and the matchweek's banked points.
   */
  readonly card: MatchPredictorPage

  /**
   * `presentCard`'s answer for that card — `editable`, `state`, the entered
   * count and what happens at the lock. The application's, not the mapper's.
   */
  readonly presentation: CardPresentation

  /**
   * Save status by key, from `useSeasonMatchPredictor`: a fixture id per
   * prediction, plus `joker` and `card` for the two card-level commands. Absent
   * keys are idle.
   */
  readonly saveStatus: Readonly<Record<string, SaveStatus>>

  /** The last refused command's reason, in the application's words. */
  readonly refusal: string | null

  /** Contract 141's settled-fixture club form. Null where unread. */
  readonly clubForm: SeasonClubFormTable | null

  /**
   * Contract 160's table rows, for the league position beside each club. Null
   * where the competition publishes no table or the read did not answer — a
   * competition that is not a league season genuinely has neither.
   *
   * THE ROWS RATHER THAN A LOOKUP FUNCTION. The route already builds a
   * name-keyed lookup for the legacy page, but a function in a source is a
   * function a test has to construct; the rows are data, and the mapper builds
   * its own index from them.
   */
  readonly table: readonly CompetitionTableRow[] | null

  /**
   * Contract 130's consensus, which the server HIDES before the matchweek locks
   * and SUPPRESSES below its own minimum entry count.
   *
   * Null covers "not readable" and "not permitted yet", and the mapper treats
   * them identically: no consensus is shown. `suppressed` is honoured as a third
   * form of the same answer. Nothing in vNext infers that a lock has passed, and
   * nothing here compares an instant to reach a permission.
   */
  readonly consensus: SeasonConsensus | null
}
