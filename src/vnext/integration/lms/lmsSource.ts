import type { LmsRoundPage } from '../../../services/supabase/seasonLms'
import type { SeasonLmsField } from '../../../services/supabase/seasonLmsField'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT LAST MAN STANDING.
 *
 * ============================ TWO READS, AND ONE WRITE ELSEWHERE =========
 *
 *   contract 116  `get_season_lms_round`   the round, the clubs, the standing
 *   contract 164  `get_season_lms_field`   the pool, the rules, the LOCK
 *   —             `save_lms_selection`     the pick, through the SHARED write
 *
 * The round read is season-scoped because the tournament read cannot see season
 * fixtures; the write is the one that already existed, because it never joined
 * fixtures itself. `seasonLms.ts` states that asymmetry and this lane does not
 * disturb it.
 *
 * ============================ WHY THE SECOND READ EARNS ITS COST =========
 *
 * Two things Stage 11's predicate asks for that contract 116 simply does not
 * carry, and one it carries WORSE:
 *
 *   • **the player pool.** "83 still in" is `field.remaining`, a server-side
 *     `count(*)`. Contract 116 knows nothing about anybody but the caller;
 *   • **the organiser's rules.** Lives, saves and the DRAWS RULE — the very
 *     fact `lmsRoundModel.ts` says it "cannot see";
 *   • **the lock.** `round.revealed` is `locks_at <= now()` evaluated by the
 *     DATABASE. Contract 116 returns the instants and no verdict, so without
 *     this read the lock is a presentation judgement. See `buildLmsModel`.
 *
 * BOTH READS RESOLVE THE SAME WINDOW, and not by coincidence: each calls
 * `predictor_internal.season_lms_current_window(competition, now())`, contract
 * 164 doing so whenever `p_window_sequence` is omitted, which is how this lane
 * calls it. The mapper still checks the two window ids agree before letting one
 * read speak for the other, because two calls straddling a lock boundary is a
 * real race and a silent mismatch would be the worst possible outcome.
 *
 * ============================ WHAT THE SECOND READ DELIBERATELY DROPS ====
 *
 * `entrants` — the row-per-player array. It is ordered (by display name, in the
 * aggregate) but **unbounded**: contract 164 puts no LIMIT on it, and a season
 * may hold thousands. Contract 116 caps its fixtures at 16; this array has no
 * such cap, so rendering it is a page whose weight is set by how popular the
 * competition got. The COUNTS are computed server-side precisely so a browser
 * need not count the array — the migration says so — and Stage 11 takes that
 * offer. Stage 9's identity rule settles the rest: the array carries `user_id`
 * and no `playerRef`, so its rows could not be navigable anyway.
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
 * ============================ TWO READS PER VISIT, AND NO PER-ROW CALL ===
 *
 * Contract 116 returns the round, its fixtures, both clubs of each and the used
 * list in a single payload; contract 164 returns the pool counts and the rules
 * in another. There is no field here a per-club, per-fixture or per-ENTRANT
 * request would fill, so a round of ten fixtures costs what a round of two
 * does, and a competition of four thousand players costs what one of four does.
 * TWO IS THE WHOLE COUNT — it does not grow with anything on the page.
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
type LmsRead =
  | { readonly kind: 'ok'; readonly page: LmsRoundPage }
  | { readonly kind: 'failed' }

/**
 * Contract 164's answer.
 *
 * ITS OWN OUTCOME, CLASSIFIED SEPARATELY. The pool is context; the round is the
 * thing a player came to act on. One must never be able to withhold the other.
 */
type LmsFieldRead =
  | { readonly kind: 'ok'; readonly field: SeasonLmsField }
  | { readonly kind: 'failed' }

export type LmsSource = {
  readonly generatedAt: string
  readonly context: LmsSourceContext
  readonly read: LmsRead
  readonly field: LmsFieldRead
}
