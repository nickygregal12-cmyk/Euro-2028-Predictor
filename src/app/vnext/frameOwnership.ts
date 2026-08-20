import { matchPath } from 'react-router'
import { isNextUi } from '../routeFlags'
import type { MigratedJourney } from '../routeFlags'
import { weeklyRoutePatterns, weeklyRoutes } from '../weeklyRoutes'

/**
 * WHICH ROUTES BRING THEIR OWN FRAME, AND THEREFORE MUST NOT INHERIT THE OLD ONE.
 *
 * ============================ THE DEFECT THIS CLOSES ======================
 *
 * Stage 14 switched nine route ELEMENTS to vNext and left `AppShell` wrapped
 * around all of them. Every vNext destination renders `VNextShell` — its own
 * masthead, its own rail, its own bottom bar — so a player on a cut-over route
 * got two navigations stacked: the legacy AppBar and the five-tab bar sized for
 * a different information architecture, around a shell that had already
 * replaced both. The tabs it drew were `Play` and `More`, which
 * `docs/product/vnext-route-migration-matrix.md` retires outright — "the word
 * `Play` therefore leaves the navigation entirely".
 *
 * ============================ WHY A PREDICATE, NOT A BOUNDARY =============
 *
 * `isTvModePath` in `src/app/shellRoutes.ts` already solves this exact shape
 * for INNOV-006 and states the reason a predicate beats a second route branch:
 * "declaring a second route boundary to get the same effect would make the next
 * route added to the wrong one silent". The same argument holds here, and more
 * strongly — these routes are flag-switched per destination, so a branch would
 * have to exist twice with the same paths and the flags would decide which copy
 * declared them.
 *
 * ============================ WHY IT CANNOT DRIFT =========================
 *
 * A table pairing a path with a flag is a second opinion about the route tree,
 * and the first one to drift would be the one a player pressed. So the pairs
 * below are the SAME `weeklyRoutePatterns` constants `src/App.tsx` registers and
 * the SAME `isNextUi` journeys it branches on, and
 * `tests/app/vnextFrameOwnership.test.ts` reads `src/App.tsx` and fails if any
 * flag-gated vNext route is missing from this table or named with a different
 * flag. Adding a destination without listing it here is a test failure, not a
 * visual regression somebody finds on a phone.
 *
 * ============================ AND WHY IT ANSWERS `false` BY DEFAULT =======
 *
 * The frame is only surrendered where a vNext surface is actually rendering, so
 * turning a destination's flag off restores that one journey AND its legacy
 * chrome together. A rollback that returned the page but not the navigation
 * around it would not be the rollback the stage contract asks for.
 */
const VNEXT_FRAMED: readonly { readonly pattern: string; readonly journey: MigratedJourney }[] = [
  { pattern: weeklyRoutes.competitions, journey: 'footballHubDiscovery' },
  { pattern: weeklyRoutePatterns.competition, journey: 'footballHubHome' },
  { pattern: weeklyRoutePatterns.matches, journey: 'footballHubMatches' },
  { pattern: weeklyRoutePatterns.matchCentre, journey: 'footballHubMatches' },
  { pattern: weeklyRoutePatterns.games, journey: 'footballHubGames' },
  { pattern: weeklyRoutePatterns.lms, journey: 'footballHubLms' },
  { pattern: weeklyRoutePatterns.championshipWildcard, journey: 'footballHubChampionship' },
  { pattern: weeklyRoutePatterns.leagues, journey: 'footballHubLeagues' },
  { pattern: weeklyRoutePatterns.player, journey: 'footballHubPlayerProfile' },
  { pattern: '/account', journey: 'footballHubAccount' },
]

/** The pairs, for the guard that proves this table matches the route tree. */
export const VNEXT_FRAMED_ROUTES = VNEXT_FRAMED

/**
 * Does a vNext surface own the frame at this address?
 *
 * Read by `AppShell` in render, so it stays a pure function of the pathname and
 * the build's flags — no state, no effect, and therefore no first paint in which
 * the legacy chrome appears and is then taken away again.
 */
export function vNextOwnsFrame(pathname: string): boolean {
  return VNEXT_FRAMED.some(
    (route) => isNextUi(route.journey) && matchPath(route.pattern, pathname) !== null,
  )
}
