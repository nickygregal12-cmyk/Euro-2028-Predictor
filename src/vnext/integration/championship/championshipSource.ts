import type { SeasonCupBracket } from '../../../services/supabase/seasonCupBracket'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT PREDICTOR CHAMPIONSHIP.
 *
 * ============================ THE READS, AND WHAT EACH IS FOR ============
 *
 *   contract 193  `get_season_cup_bracket`   the bracket, the tie, the seed,
 *                                            the Penalty Number, the champion
 *
 * More will join it — contract 167's group stage and contract 133's own-group
 * view are the other two the page needs — and each arrives with its OWN
 * outcome, for the reason Stages 10 and 11 both settled: a page assembled from
 * several reads must not have a single "loaded", because the reads do not
 * succeed or fail together and their permissions are not the same.
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

export type ChampionshipSource = {
  readonly generatedAt: string
  readonly context: ChampionshipSourceContext
  readonly bracket: BracketRead
}
