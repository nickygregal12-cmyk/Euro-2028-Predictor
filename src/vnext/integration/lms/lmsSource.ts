import type { LmsRoundPage } from '../../../services/supabase/seasonLms'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT LAST MAN STANDING.
 *
 * ============================ ONE READ, AND ONE WRITE ELSEWHERE ==========
 *
 *   contract 116  `get_season_lms_round`   the round, the clubs, the standing
 *   —             `save_lms_selection`     the pick, through the SHARED write
 *
 * The read is season-scoped because the tournament read cannot see season
 * fixtures; the write is the one that already existed, because it never joined
 * fixtures itself. `seasonLms.ts` states that asymmetry and this lane does not
 * disturb it.
 *
 * ============================ THE WRITE IS NOT IN THIS TYPE ==============
 *
 * Deliberately. `save_lms_selection` is optimistically concurrent — it carries
 * the version the caller last read, and a racing save is refused as `PT409` —
 * and `seasonLms.ts` keeps that version PRIVATE to the gateway, on the grounds
 * that "a pick is a player's intention and carries no version". That is right,
 * and this lane honours it: the presentation model has no version field, the
 * intent has no version field, and nothing in `src/vnext/models/` knows the
 * concept exists. The hook holds the gateway; the page emits an intention.
 *
 * ============================ ONE READ PER VISIT, AND NO PER-ROW CALL ====
 *
 * Contract 116 returns the round, its fixtures, both clubs of each and the
 * used list in a single payload. There is no field here a per-club or
 * per-fixture request would fill, so a round of ten fixtures costs what a round
 * of two does.
 *
 * ============================ NOTHING HERE IS A CLOCK ====================
 *
 * `generatedAt` is supplied, so `buildLmsModel` is pure and a test can pin the
 * instant a lock is judged against — which matters more here than anywhere else
 * in the lane, because that judgement decides whether a control is offered.
 */

type LmsSourceContext = {
  readonly tournamentId: string
  readonly competitionName: string
  readonly seasonLabel: string
  /** The game's own name, as the host states it. */
  readonly gameName: string
}

/**
 * Contract 116's answer.
 *
 * `failed` is about the READ. Every other state a player can be in — not
 * offered, not entered, between rounds, eliminated — is INSIDE the payload,
 * because the server knows them and this lane does not guess them.
 */
export type LmsRead =
  | { readonly kind: 'ok'; readonly page: LmsRoundPage }
  | { readonly kind: 'failed' }

export type LmsSource = {
  readonly generatedAt: string
  readonly context: LmsSourceContext
  readonly read: LmsRead
}
