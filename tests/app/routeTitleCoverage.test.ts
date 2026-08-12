import { describe, expect, it } from 'vitest'
import { getRouteTitle } from '../../src/app/RouteAccessibility'
import { declaredRoutes, redirectRoutes } from './declaredRoutes'

const SAMPLE_PARAMS: Record<string, string> = {
  fixtureId: 'fixture-1',
  code: 'ABC123',
  id: '42',
  rivalId: '42',
  playerId: '42',
  competitionSlug: 'premier-league',
  seasonSlug: '2026-27',
  // The tournament's own journeys, un-parked 11 August 2026.
  letter: 'A',
  matchRef: 'R16-1',
}

function concretePath(route: string): string {
  return route.replace(/:(\w+)/g, (_, name: string) => {
    const value = SAMPLE_PARAMS[name]
    if (!value) throw new Error(`No sample value for :${name} — add one`)
    return value
  })
}

const NOT_FOUND = 'Page not found'

/**
 * Addresses that share a title with another route because they share the PAGE.
 *
 * The assertion below exists to catch a parameterised sibling swallowing its
 * neighbour's title — `/league/overall` answering "League details" because
 * `/league/:id` was listed first. That is a list-order defect. This is not one:
 * `/league` and `/leagues` are one surface at two addresses on the Euro build,
 * and on the Hub `/league` renders a redirect to `/leagues`, so a title that
 * differed would name a page neither address shows.
 *
 * It cannot be detected the way `redirectRoutes` is, because that reads
 * `element={<Navigate` out of `App.tsx` and this element is a variant dispatcher
 * that decides at runtime. Named here, with the reason, rather than widened into
 * a rule — a second entry needs the same argument made again.
 */
const ONE_PAGE_TWO_ADDRESSES = ['/league']

describe('route titles', () => {
  it('finds the routes to check, so the sweep is not vacuous', () => {
    expect(declaredRoutes.length).toBeGreaterThan(20)
  })

  it('still reports a genuinely unknown path as not found', () => {
    expect(getRouteTitle('/no-such-page')).toBe(NOT_FOUND)
    expect(getRouteTitle('/predict/nope/deeper')).toBe(NOT_FOUND)
  })

  it('gives every declared route a title that is not the not-found fallback', () => {
    const untitled = declaredRoutes.filter(
      (route) => getRouteTitle(concretePath(route)) === NOT_FOUND,
    )

    expect(
      untitled,
      `these routes are declared in src/App.tsx but fall through to the ` +
        `not-found title: ${untitled.join(', ')}`,
    ).toEqual([])
  })

  it('gives each route its own title rather than a parameterised sibling', () => {
    const shared = new Map<string, string[]>()
    for (const route of declaredRoutes) {
      const title = getRouteTitle(concretePath(route))
      shared.set(title, [...(shared.get(title) ?? []), route])
    }

    const collisions = [...shared.entries()]
      .map(
        ([title, routes]) =>
          [
            title,
            routes.filter((r) => !redirectRoutes.includes(r) && !ONE_PAGE_TWO_ADDRESSES.includes(r)),
          ] as const,
      )
      .filter(([, routes]) => routes.length > 1)
      .map(([title, routes]) => `${title}: ${routes.join(', ')}`)

    expect(collisions, 'routes sharing a title — check the list order').toEqual([])
  })

  it('titles the root Home whichever of its two pages is showing', () => {
    // This assertion used to record a DIFFERENCE: signed out the root was the
    // landing page and titled "Home", signed in it was the competition chooser
    // and titled "Competitions". The chooser is gone — the signed-in root is
    // the personalised dashboard, its heading says Home and the global
    // destination that reaches it says Home — so the two names converged and
    // the tab agrees with the page in both states. The catalogue the old title
    // named is at `/competitions`, which has a title of its own.
    expect(getRouteTitle('/')).toBe('Home')
    expect(getRouteTitle('/', { signedOut: false })).toBe('Home')
    expect(getRouteTitle('/', { signedOut: true })).toBe('Home')
  })

  it('leaves every other route’s title alone when signed out', () => {
    for (const route of declaredRoutes.filter((route) => route !== '/')) {
      expect(getRouteTitle(concretePath(route), { signedOut: true })).toBe(
        getRouteTitle(concretePath(route)),
      )
    }
  })

  it('names the canonical weekly pages', () => {
    expect(getRouteTitle('/')).toBe('Home')
    expect(getRouteTitle('/play')).toBe('Play')
    expect(getRouteTitle('/matches')).toBe('Matches')
    expect(getRouteTitle('/leagues')).toBe('Leagues')
    expect(getRouteTitle('/competitions/premier-league/2026-27')).toBe(
      'Premier League 2026/27',
    )
    expect(getRouteTitle('/competitions/premier-league/2026-27/games')).toBe(
      'Premier League 2026/27 Games',
    )
    expect(
      getRouteTitle('/competitions/premier-league/2026-27/games/match-predictor'),
    ).toBe('Premier League 2026/27 Match Predictor')
    expect(getRouteTitle('/competitions/premier-league/2026-27/games/lms')).toBe(
      'Premier League 2026/27 Last Man Standing',
    )
    expect(getRouteTitle('/competitions/premier-league/2026-27/games/championship')).toBe(
      'Premier League 2026/27 Predictor Championship',
    )
  })

  it('keeps the Championship title across selected-instance child routes', () => {
    const title = 'Scottish Premiership 2026/27 Predictor Championship'
    const base = '/competitions/scottish-premiership/2026-27/games/championship/private-1'
    expect(getRouteTitle(base)).toBe(title)
    expect(getRouteTitle(`${base}/table`)).toBe(title)
    expect(getRouteTitle(`${base}/fixtures`)).toBe(title)
  })

  it('titles the tournament routes now that they are registered', () => {
    // THIS ASSERTION USED TO SAY THE OPPOSITE, and inverting it is the point
    // rather than an accident. While the tournament journeys were parked, a
    // title for `/predict` would have named a page that answered 404, so the
    // guard demanded the not-found fallback. They are registered now — refused
    // on the Hub by the deployment gate rather than absent — and a registered
    // route with no title is exactly what `routeTitleCoverage` exists to catch.
    expect(getRouteTitle('/predict')).toBe('Predict')
    expect(getRouteTitle('/predict/groups/A')).toBe('Group predictions')
    expect(getRouteTitle('/games/lms')).toBe('Last Man Standing')
    expect(getRouteTitle('/match/R16-1')).toBe('Match Centre')
    expect(getRouteTitle('/league/overall')).toBe('Overall standings')
  })

  it('still reports the one Euro address nothing registers as not found', () => {
    // `/competitions/euro/2028/original` was never un-parked with the rest: the
    // weekly competition tree is the Hub's product and the tournament does not
    // live inside it. Kept as the check that the inversion above was scoped.
    expect(getRouteTitle('/competitions/euro/2028/original')).toBe(NOT_FOUND)
  })
})
