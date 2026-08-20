import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OUTSIDE_THE_LEGACY_FRAME,
  VNEXT_FRAMED_ROUTES,
  vNextOwnsFrame,
} from '../../src/app/vnext/frameOwnership'
import { weeklyRoutePatterns, weeklyRoutes } from '../../src/app/shellRoutes'

/**
 * THE TABLE AND THE ROUTE TREE MUST AGREE, AND THIS IS WHAT MAKES THEM.
 *
 * `frameOwnership.ts` names which addresses render a vNext surface, so that
 * `AppShell` can stand aside instead of wrapping a shell in a second one. That
 * is a SECOND OPINION about the route tree, and the first one to drift would be
 * the one a player pressed: a destination cut over in `src/App.tsx` but not
 * listed there renders two navigations, and nothing else in the suite notices —
 * which is exactly how the defect this closes survived Stage 14 in the first
 * place.
 *
 * So the guard reads `src/App.tsx` itself rather than a copy of it.
 */

const APP = readFileSync('src/App.tsx', 'utf8')

/** The route-path expressions App.tsx registers, resolved to their values. */
const PATH_VALUES: Readonly<Record<string, string>> = {
  'weeklyRoutes.hub': weeklyRoutes.hub,
  'weeklyRoutes.play': weeklyRoutes.play,
  'weeklyRoutes.matches': weeklyRoutes.matches,
  'weeklyRoutes.leagues': weeklyRoutes.leagues,
  'weeklyRoutes.more': weeklyRoutes.more,
  'weeklyRoutes.competitions': weeklyRoutes.competitions,
  ...Object.fromEntries(
    Object.entries(weeklyRoutePatterns).map(([key, value]) => [
      `weeklyRoutePatterns.${key}`,
      value,
    ]),
  ),
}

/**
 * The Hub build, which is the one every case below is about unless it says
 * otherwise. `/` is a shared address and the Euro build means the tournament's
 * home by it, so the predicate takes the site rather than assuming one.
 */
const HUB = { servesDomesticCompetitions: true } as const
const EURO = { servesDomesticCompetitions: false } as const

/** Journeys owned elsewhere: not Football Hub destinations, not this table's. */
const NOT_A_HUB_DESTINATION = new Set(['publicLanding', 'seasonMatchPredictor'])

/**
 * Every `(path, journey)` pair `src/App.tsx` actually registers.
 *
 * Read by walking `path=` and `isNextUi(...)` occurrences IN ORDER and pairing
 * each flag with the path attribute above it, because a route's `path` always
 * precedes its `element`. A regex over one `<Route>` element cannot be trusted
 * here — the elements contain nested JSX, so `/>` does not reliably end one.
 */
function registeredPairs(): ReadonlyMap<string, Set<string>> {
  const pairs = new Map<string, Set<string>>()
  const token = /path=(?:\{([^}]+)\}|"([^"]+)")|isNextUi\('([A-Za-z]+)'\)/g
  let path: string | null = null

  for (const match of APP.matchAll(token)) {
    const [, expression, literal, journey] = match
    if (expression !== undefined) {
      path = PATH_VALUES[expression.trim()] ?? null
      continue
    }
    if (literal !== undefined) {
      path = literal
      continue
    }
    if (journey === undefined || path === null) continue
    if (NOT_A_HUB_DESTINATION.has(journey)) continue
    const journeys = pairs.get(path) ?? new Set<string>()
    journeys.add(journey)
    pairs.set(path, journeys)
  }

  return pairs
}

describe('the frame-ownership table matches the route tree', () => {
  it('finds the flag-gated routes at all, so a silent parse failure cannot pass', () => {
    // Without this, a regex that matched nothing would satisfy every assertion
    // below by having nothing to check.
    const pairs = registeredPairs()
    expect(pairs.size).toBeGreaterThanOrEqual(9)
    expect(pairs.get(weeklyRoutePatterns.competition)).toContain('footballHubHome')
  })

  it('lists every flag-gated vNext route that renders a surface', () => {
    const listed = new Set(
      VNEXT_FRAMED_ROUTES.map((route) => `${route.pattern} → ${route.journey}`),
    )

    const outside = new Set(OUTSIDE_THE_LEGACY_FRAME)

    const missing: string[] = []
    for (const [path, journeys] of registeredPairs()) {
      // A ROUTE REGISTERED OUTSIDE `AppShell` HAS NO FRAME TO SURRENDER, and
      // the set that says so is a named list rather than a default — see the
      // module. Omitting the check for these would let a route inside the shell
      // escape it too.
      if (outside.has(path)) continue
      for (const journey of journeys) {
        if (!listed.has(`${path} → ${journey}`)) missing.push(`${path} → ${journey}`)
      }
    }

    // Named in the failure rather than counted, because the fix is to add the
    // exact row the message prints.
    expect(missing).toEqual([])
  })

  it('registers every address it excuses from the frame table', () => {
    // The excuse list is the one place a vNext route can legitimately be absent
    // from `VNEXT_FRAMED`, so a stale entry there would silently reopen the
    // hole. Every address it names must still be a route.
    const registered = registeredPairs()
    for (const path of OUTSIDE_THE_LEGACY_FRAME) {
      expect(registered.has(path), `${path} is excused but is not a flag-gated route`).toBe(
        true,
      )
    }
  })

  it('lists nothing the route tree does not register', () => {
    const registered = registeredPairs()
    const stale = VNEXT_FRAMED_ROUTES.filter(
      (route) => !registered.get(route.pattern)?.has(route.journey),
    ).map((route) => `${route.pattern} → ${route.journey}`)

    expect(stale).toEqual([])
  })
})

describe('who owns the frame at a given address', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('surrenders the frame where the destination is cut over', () => {
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'true')
    expect(vNextOwnsFrame('/competitions/premier-league/2026-27', HUB)).toBe(true)
  })

  it('keeps the frame where that destination is rolled back', () => {
    // THE ROLLBACK HAS TO TAKE THE CHROME WITH IT. A flag turned off that
    // returned the legacy page inside no navigation would be a worse state than
    // either position of the switch.
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'false')
    expect(vNextOwnsFrame('/competitions/premier-league/2026-27', HUB)).toBe(false)
  })

  it('is per destination rather than per section', () => {
    // Home on, Leagues off: the competition's own address gives up the frame
    // and its Leagues table keeps it, in the same competition, in one build.
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'true')
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_LEAGUES', 'false')
    expect(vNextOwnsFrame('/competitions/premier-league/2026-27', HUB)).toBe(true)
    expect(vNextOwnsFrame('/competitions/premier-league/2026-27/leagues', HUB)).toBe(false)
  })

  it('does not mistake the catalogue for a competition, or the reverse', () => {
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_DISCOVERY', 'true')
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'false')
    expect(vNextOwnsFrame('/competitions', HUB)).toBe(true)
    // `/competitions/:c/:s` must not match the `/competitions` row: Discovery is
    // on and Home is off, so a loose match would strip the frame from a legacy
    // competition dashboard.
    expect(vNextOwnsFrame('/competitions/premier-league/2026-27', HUB)).toBe(false)
  })

  it('surrenders the frame at the root while it is resolving', () => {
    // `/` only redirects, but it redirects AFTER a membership read, and the
    // frame around that wait is what the player looks at. Keeping the legacy
    // one here is precisely the flash this closes.
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'true')
    expect(vNextOwnsFrame('/', HUB)).toBe(true)
  })

  it('keeps the frame at the root when Home is rolled back', () => {
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'false')
    expect(vNextOwnsFrame('/', HUB)).toBe(false)
  })

  it('keeps the tournament build its own frame at the shared root', () => {
    // `/` IS ONE OF `variantRoutes.ts`'S FOUR SHARED PATHS, and on the Euro
    // deployment it is `euro-home` rather than any vNext surface. The cutover
    // flags reach both sites from one `netlify.toml`, so a frame surrendered on
    // the flag alone would leave the tournament's own home with no navigation
    // at all — and `VNextRootDestination` hands that build back to the variant
    // dispatcher for the same reason.
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'true')
    expect(vNextOwnsFrame('/', EURO)).toBe(false)
    expect(vNextOwnsFrame('/', HUB)).toBe(true)
  })

  it('surrenders the frame at an absorbed address so an old bookmark does not flash the old product', () => {
    // These RESOLVE into a vNext destination, some after a membership read, and
    // the frame around that wait is what the player looks at. Painting the
    // retired masthead and its five-tab bar and then replacing them is the
    // flash the cutover exists to remove.
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'true')
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_MATCHES', 'true')
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_LEAGUES', 'true')
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_ACCOUNT', 'true')
    for (const path of ['/play', '/matches', '/leagues', '/more', '/profile']) {
      expect(vNextOwnsFrame(path, HUB), path).toBe(true)
      // …and the tournament build, where the legacy element still renders,
      // keeps the chrome it needs.
      expect(vNextOwnsFrame(path, EURO), path).toBe(false)
    }
  })

  it('keeps the frame at an absorbed address whose destination is rolled back', () => {
    // The redirect is gated on the ABSORBING destination's flag, so rolling
    // that destination back restores the legacy page AND its chrome together.
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_MATCHES', 'false')
    expect(vNextOwnsFrame('/matches', HUB)).toBe(false)
  })

  it('keeps the frame on the addresses the cutover did not touch', () => {
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_HOME', 'true')
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_MATCHES', 'true')
    for (const path of [
      '/about',
      '/fixtures',
      '/admin/results',
      '/competitions/premier-league/2026-27/tv',
    ]) {
      expect(vNextOwnsFrame(path, HUB), path).toBe(false)
    }
  })
})
