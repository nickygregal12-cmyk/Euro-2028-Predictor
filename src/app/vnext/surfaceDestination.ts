import {
  competitionRefFromPath,
  competitionRoute,
  competitionSeasonWrappedRoute,
  competitionSectionRoute,
  weeklyRoutes,
  type CompetitionRouteRef,
} from '../weeklyRoutes'
import type { ShellDestinationId } from '../../vnext/models/shell'

/**
 * WHICH OF THE FOUR A CRASHED ADDRESS BELONGED TO.
 *
 * ============================ WHY THIS EXISTS AT ALL =====================
 *
 * `VNextSurfaceBoundary` is mounted as a LAYOUT route, above every cutover
 * destination at once, because a boundary underneath the seam's hosts cannot
 * catch the hosts themselves. A layout route has no path of its own, so
 * `useParams()` there is empty and the boundary cannot be told which
 * destination it is standing in front of by the router.
 *
 * It has to know, and the reason is the one `VNextStates.tsx` already wrote
 * down for itself: a page that cannot show its content is exactly when a player
 * looks at the navigation to work out where they are, and lighting the wrong
 * destination there is the one moment the navigation lies. `'none'` is honest —
 * it lights nothing — but on a competition surface it throws away a fact the
 * address plainly holds.
 *
 * ============================ IT IS NOT A SECOND ROUTE TABLE =============
 *
 * Every address it compares against is BUILT by the application's own route
 * authority — `competitionRoute` and `competitionSectionRoute` from
 * `weeklyRoutes.ts` — rather than written out again as literals here. A
 * hand-copied `'/matches'` would be a second opinion about where Matches lives,
 * and the first one to drift would be the one a crashed player was shown.
 *
 * ============================ AND IT NEVER GUESSES =======================
 *
 * An address this cannot place resolves to `'none'`, which lights nothing. That
 * is the truthful answer for `/account`, `/join/:code`, `/welcome` and anything
 * added tomorrow — the player is somewhere outside the four, which is exactly
 * what an unlit navigation says.
 */
export function shellDestinationFromPath(pathname: string): ShellDestinationId | 'none' {
  const ref = competitionRefFromPath(pathname)
  if (ref === null) return globalDestination(pathname)

  // Longest-first, because every section address is a prefix of the addresses
  // beneath it and the competition root is a prefix of all of them.
  if (isUnder(pathname, competitionSectionRoute(ref, 'matches'))) return 'matches'
  if (isUnder(pathname, competitionSectionRoute(ref, 'games'))) return 'games'
  if (isUnder(pathname, competitionSectionRoute(ref, 'leagues'))) return 'leagues'

  /**
   * A PLAYER'S SEASON BELONGS TO LEAGUES, not to the competition root it is
   * addressed under.
   *
   * The address is `…/:competition/:season/players/:playerId`, so a prefix test
   * against the competition root would place it on Home. It is reached from the
   * Leagues table and from the Match Centre, and the capability matrix names
   * Leagues as its doorway — so Leagues is where a player who arrived at a
   * broken profile expects the navigation to say they are.
   */
  if (isUnder(pathname, `${competitionRoute(ref)}/players`)) return 'leagues'

  /**
   * SEASON WRAPPED LIGHTS NOTHING, BECAUSE ITS OWN SURFACE LIGHTS NOTHING.
   *
   * `VNextSeasonWrapped` renders `destination="none"` — a finished season's
   * record is not one of the four. Without this row the prefix fall-through
   * would answer Home, so the working page and the crashed page would disagree
   * about where the player is, which is precisely the defect the destination
   * prop was made required to prevent.
   */
  if (isUnder(pathname, competitionSeasonWrappedRoute(ref))) return 'none'

  // The Competition Deck merged `/` and the competition front door into one
  // visible destination, so the competition root — and anything under it this
  // function has not placed — is Home.
  return 'home'
}

/**
 * The addresses outside the competition tree.
 *
 * The cross-competition scopes are the same destinations at platform level:
 * `/matches` is the Matches destination in its across-your-competitions mode,
 * and `/leagues` resolves through the absorbed-address layer into Leagues.
 */
function globalDestination(pathname: string): ShellDestinationId | 'none' {
  if (pathname === weeklyRoutes.hub) return 'home'
  if (isUnder(pathname, weeklyRoutes.matches)) return 'matches'
  if (isUnder(pathname, weeklyRoutes.leagues)) return 'leagues'
  // `/play` is the absorbed attention layer rather than a fifth destination,
  // and Home is where the capability matrix says its job now lives.
  if (isUnder(pathname, weeklyRoutes.play)) return 'home'
  return 'none'
}

/** `path` itself, or a child of it — never a sibling that merely shares a prefix. */
function isUnder(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * Where a shell destination press should go from a crashed surface.
 *
 * ============================ IN A COMPETITION ===========================
 *
 * The competition's own section, so a player who breaks the Championship and
 * presses Matches stays in the competition they were in.
 *
 * ============================ OUTSIDE ONE ================================
 *
 * THE FIRST VERSION SENT ALL FOUR TO THE HUB ROOT, AND THREE OF THOSE WERE A
 * LIE. `/matches` and `/leagues` are registered global addresses — this module
 * already recognises them on the way IN, in `globalDestination` — so discarding
 * the reverse mapping meant a player at a broken `/account` who pressed
 * "Matches" landed on Home. `VNextStates.tsx` names that exact class of defect:
 * *"a page that cannot show its content is exactly when a player looks at the
 * navigation to work out where they are, and it was the one moment the
 * navigation lied."* A control that goes somewhere other than its label teaches
 * the same lesson as an inert one.
 *
 * `games` IS the exception rather than an oversight. There is no
 * cross-competition Games address: the route matrix absorbed `/play` into Home
 * and never created a global games catalogue, because which games exist is a
 * fact about a competition. The hub root is where a player picks one, so it is
 * the honest answer here rather than a guess.
 */
export function destinationRouteFromPath(
  pathname: string,
  destination: ShellDestinationId,
): string {
  const ref: CompetitionRouteRef | null = competitionRefFromPath(pathname)
  if (ref !== null) {
    return destination === 'home'
      ? competitionRoute(ref)
      : competitionSectionRoute(ref, destination)
  }

  switch (destination) {
    case 'matches':
      return weeklyRoutes.matches
    case 'leagues':
      return weeklyRoutes.leagues
    case 'home':
    case 'games':
      return weeklyRoutes.hub
    default:
      return weeklyRoutes.hub
  }
}
