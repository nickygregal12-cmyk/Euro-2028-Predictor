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
type FramedRoute = {
  readonly pattern: string
  readonly journey: MigratedJourney
  /**
   * True where the row is one of `variantRoutes.ts`'s SHARED paths — an address
   * both deployments answer and mean a different product by.
   *
   * Only `/` is currently in that position among the rows below, and it is why
   * this field exists rather than being assumed away: on the Euro build the
   * root is the tournament's own home and no vNext surface renders there, so a
   * frame surrendered on the strength of the Hub's flag would leave the
   * tournament's home page with no navigation at all.
   */
  readonly domesticOnly?: true
}

const VNEXT_FRAMED: readonly FramedRoute[] = [
  // THE ROOT SURRENDERS THE FRAME TOO, and it is the reason this row exists at
  // all. `/` only redirects — but it redirects AFTER a membership read, and
  // while that read is in flight the frame around it is what a player is
  // looking at. Left to `AppShell`, every arrival painted the retired masthead
  // and five-tab bar and then replaced them, which is the flash the cutover
  // exists to remove rather than to introduce.
  { pattern: weeklyRoutes.hub, journey: 'footballHubHome', domesticOnly: true },
  { pattern: weeklyRoutes.competitions, journey: 'footballHubDiscovery' },
  { pattern: weeklyRoutePatterns.competition, journey: 'footballHubHome' },
  { pattern: weeklyRoutePatterns.matches, journey: 'footballHubMatches' },
  { pattern: weeklyRoutePatterns.matchCentre, journey: 'footballHubMatches' },
  { pattern: weeklyRoutePatterns.games, journey: 'footballHubGames' },
  { pattern: weeklyRoutePatterns.matchPredictor, journey: 'footballHubPredictor' },
  {
    pattern: weeklyRoutePatterns.createPrivatePlay,
    journey: 'footballHubCreatePrivatePlay',
  },
  { pattern: weeklyRoutePatterns.lms, journey: 'footballHubLms' },
  { pattern: weeklyRoutePatterns.championshipWildcard, journey: 'footballHubChampionship' },
  { pattern: weeklyRoutePatterns.leagues, journey: 'footballHubLeagues' },
  { pattern: weeklyRoutePatterns.player, journey: 'footballHubPlayerProfile' },
  { pattern: '/account', journey: 'footballHubAccount' },

  // THE ABSORBED ADDRESSES SURRENDER THE FRAME TOO, for the same reason `/`
  // does and not for a different one. Each resolves into a vNext destination —
  // some after a membership read — and the frame around that wait is what the
  // player looks at. Left to `AppShell`, every arrival at an old bookmark
  // painted the retired masthead and its five-tab bar and then replaced them.
  //
  // The three global ones are `variantRoutes.ts`'s shared paths and `/more`,
  // `/profile` and `/more/scoring` are served on both builds, so all six are
  // `domesticOnly`: on the Euro deployment `absorbedAddresses.tsx` renders the
  // legacy element unchanged, and it needs this chrome around it.
  { pattern: weeklyRoutes.play, journey: 'footballHubHome', domesticOnly: true },
  { pattern: weeklyRoutes.matches, journey: 'footballHubMatches', domesticOnly: true },
  { pattern: weeklyRoutes.leagues, journey: 'footballHubLeagues', domesticOnly: true },
  { pattern: weeklyRoutes.more, journey: 'footballHubAccount', domesticOnly: true },
  { pattern: '/more/scoring', journey: 'footballHubGames', domesticOnly: true },
  { pattern: '/profile', journey: 'footballHubAccount', domesticOnly: true },
  { pattern: weeklyRoutePatterns.play, journey: 'footballHubHome' },
  { pattern: weeklyRoutePatterns.matchPredictorStandings, journey: 'footballHubLeagues' },
]

/** The pairs, for the guard that proves this table matches the route tree. */
export const VNEXT_FRAMED_ROUTES = VNEXT_FRAMED

/**
 * ADDRESSES THAT NEVER INHERIT THE LEGACY FRAME IN THE FIRST PLACE.
 *
 * A flag-gated vNext route that is not in `VNEXT_FRAMED` is normally the exact
 * defect this module exists to catch — a destination cut over and left wrapped
 * in a second navigation. These are the routes for which it is not, because
 * they are registered OUTSIDE `AppShell` in `src/App.tsx` and there is no frame
 * to surrender:
 *
 *   `/welcome`     first sign-in, inside `RequireAuth` and outside
 *                  `RequireWelcome` — a player being set up is not yet in the
 *                  shell, on either presentation.
 *   `/join/:code`  the invite deep link, deliberately outside the auth gate so
 *                  it can stash the code and route a signed-out visitor
 *                  through sign-up.
 *
 * They are NAMED rather than defaulted, so adding a vNext route outside the
 * shell is a decision somebody records here and not a row the guard silently
 * stops asking about. `tests/app/vnextFrameOwnership.test.ts` reads this set for
 * exactly that reason.
 */
export const OUTSIDE_THE_LEGACY_FRAME: readonly string[] = ['/welcome', '/join/:code']

export type FrameOwnershipContext = {
  /**
   * `siteConfiguration.ts`'s own field, passed in rather than read here.
   *
   * This module is a pure function of an address and the build's flags, and
   * `AppShell` already holds the site — so taking a React context here would
   * make the one predicate the frame depends on unusable from a test that has
   * no provider.
   */
  readonly servesDomesticCompetitions: boolean
}

/**
 * Does a vNext surface own the frame at this address?
 *
 * Read by `AppShell` in render, so it stays a pure function of the pathname and
 * the build's flags — no state, no effect, and therefore no first paint in which
 * the legacy chrome appears and is then taken away again.
 */
export function vNextOwnsFrame(pathname: string, context: FrameOwnershipContext): boolean {
  return VNEXT_FRAMED.some(
    (route) =>
      (context.servesDomesticCompetitions || route.domesticOnly !== true) &&
      isNextUi(route.journey) &&
      matchPath(route.pattern, pathname) !== null,
  )
}
