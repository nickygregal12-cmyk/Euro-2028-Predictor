import { weeklyRoutes } from '../../app/weeklyRoutes'
import type { InviteJoinResult } from './useInviteCode'

/**
 * Where a just-accepted invite opens, on the build that accepted it.
 *
 * WHY THIS IS NOT SIMPLY `/league/:id`. It was, and on the Hub build that is a
 * wrong destination rather than a debatable one. `/league/:id` is a TOURNAMENT
 * surface end to end, and the measurement is not subtle:
 *
 *   * `LeagueDetailPage` calls `useTournamentData()` for the group-match count
 *     its unrevealed progress rows are denominated in, and
 *     `useTournamentEntryLocked()` — which consumes BOTH tournament providers —
 *     for whether anything may be revealed at all;
 *   * every member row it renders navigates to `/tournament/profile/:playerId`
 *     and `/h2h/:rivalId`, which are the tournament's own two routes;
 *   * its server read is `get_league_members`, which contract 128 made REFUSE a
 *     season league by name, because ADR 0012 ranks a season on cumulative
 *     points with matchweeks played while that read carries the tournament's
 *     five final tie-breakers. A season league has its own read and its own
 *     table, and they are deliberately different tables.
 *
 * So the page is not "a league table that happens to sit inside the tournament
 * boundary". On a build that does not serve the Euro tournament it is a route
 * `TournamentJourney` refuses, and even if it did not, the read behind it would.
 *
 * THE HONEST ANSWER IS THE PRIVATE PLAY LIST, and it is the answer this file's
 * neighbour already gives. `landOn` has always sent a joined private COMPETITION
 * to `weeklyRoutes.leagues` with a note saying a private competition has no page
 * of its own yet and that the list is where it appears. A league on the Hub is
 * in exactly that position: it is listed there, with its name, its owner, its
 * member count and — when its game is the Match Predictor — a link on to the
 * competition workspace that `privatePlayHref` owns. Landing the player one step
 * short of the league is a smaller loss than landing them on a page whose own
 * server read will refuse the league they just joined.
 *
 * IT IS ADDRESSING AND NEVER PERMISSION, exactly as `variantRoutes.ts` is. It
 * decides which page a successful join opens; it grants nothing, joins nothing
 * and hides nothing. The join has already happened by the time anything calls
 * this, and both destinations are the player's own.
 *
 * PURE, so the rule is assertable without rendering a router: the caller reads
 * `servesEuroTournament` from `useSite()` and passes it in.
 */
export function joinedInviteHref(
  joined: InviteJoinResult,
  servesEuroTournament: boolean,
): string {
  if (joined.kind === 'league' && servesEuroTournament) {
    return `/league/${joined.leagueId}`
  }
  return weeklyRoutes.leagues
}
