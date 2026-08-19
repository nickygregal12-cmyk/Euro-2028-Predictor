import type { SeasonCupBracket } from '../../../services/supabase/seasonCupBracket'
import type { SeasonCupGroupStage } from '../../../services/supabase/seasonCupGroupStage'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT PREDICTOR CHAMPIONSHIP.
 *
 * ============================ THE READS, AND WHAT EACH IS FOR ============
 *
 *   contract 193  `get_season_cup_bracket`      the bracket, the tie, the
 *                                               seed, the Penalty Number,
 *                                               the champion
 *   contract 167  `get_season_cup_group_stage`  the group tables
 *
 * Each arrives with its OWN outcome, for the reason Stages 10 and 11 both
 * settled: a page assembled from several reads must not have a single
 * "loaded", because the reads do not succeed or fail together and their
 * permissions are not the same. It bites here more than anywhere: a
 * Championship IN its group phase has a real table and a bracket that does not
 * exist yet, so the two reads disagree by design.
 *
 * ============================ ELIMINATION IS NOT IN HERE, AND THAT IS THE
 * POINT ===================================================================
 *
 * No season Championship read returns `bonus_competition_entrants.outcome` —
 * not 193, not 133, not 167, not 120. So this type has no field for it, and
 * `buildChampionshipModel` has nothing to read one from. That is deliberate:
 * the surface says nothing about elimination rather than inferring it from a
 * lost tie, which is the derivation the stage's headline predicate forbids and
 * which is wrong whenever a competition has not finished eliminating.
 *
 * It is a RECORDED BACKEND GAP rather than a design position. Stage 12 is not
 * complete until an authority supplies it.
 *
 * ============================ NOTHING HERE IS A CLOCK ====================
 *
 * `generatedAt` is supplied so the mapper stays pure. Note contract 193 also
 * returns `server_now`, the DATABASE's own clock — which is the better instant
 * wherever the two disagree, and is carried through the read rather than
 * replaced by this one.
 */

type ChampionshipSourceContext = {
  readonly tournamentId: string
  readonly competitionId: string
  readonly competitionName: string
  readonly seasonLabel: string
  /** The game's own name, as the host states it. */
  readonly gameName: string
}

/**
 * Contract 193's answer.
 *
 * `failed` is about the READ. Every other state a player can be in — not
 * entered, not drawn, between rounds — is INSIDE the payload, because the
 * server knows them and this lane does not guess them.
 */
type BracketRead =
  | { readonly kind: 'ok'; readonly bracket: SeasonCupBracket }
  | { readonly kind: 'failed' }

/**
 * Contract 167's answer, on the same terms.
 *
 * `available: false` is INSIDE the payload and is the server saying this
 * competition has no group stage — a different fact from the read failing, and
 * the reason `failed` sits outside rather than collapsing into it.
 */
type GroupStageRead =
  | { readonly kind: 'ok'; readonly groupStage: SeasonCupGroupStage }
  | { readonly kind: 'failed' }

export type ChampionshipSource = {
  readonly generatedAt: string
  readonly context: ChampionshipSourceContext
  readonly bracket: BracketRead
  readonly groupStage: GroupStageRead
}
