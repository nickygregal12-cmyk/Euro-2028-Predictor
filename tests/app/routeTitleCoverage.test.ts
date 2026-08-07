import { describe, expect, it } from 'vitest'
import { getRouteTitle } from '../../src/app/RouteAccessibility'
import { declaredRoutes, redirectRoutes } from './declaredRoutes'

const SAMPLE_PARAMS: Record<string, string> = {
  code: 'ABC123',
  id: '42',
  rivalId: '42',
  playerId: '42',
  competitionSlug: 'premier-league',
  seasonSlug: '2026-27',
}

function concretePath(route: string): string {
  return route.replace(/:(\w+)/g, (_, name: string) => {
    const value = SAMPLE_PARAMS[name]
    if (!value) throw new Error(`No sample value for :${name} — add one`)
    return value
  })
}

const NOT_FOUND = 'Page not found'

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
      .map(([title, routes]) => [title, routes.filter((r) => !redirectRoutes.includes(r))] as const)
      .filter(([, routes]) => routes.length > 1)
      .map(([title, routes]) => `${title}: ${routes.join(', ')}`)

    expect(collisions, 'routes sharing a title — check the list order').toEqual([])
  })

  it('titles the root by which of its two pages is showing', () => {
    expect(getRouteTitle('/')).toBe('Competitions')
    expect(getRouteTitle('/', { signedOut: false })).toBe('Competitions')
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
    expect(getRouteTitle('/')).toBe('Competitions')
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

  it('does not title retired Euro/tournament routes as shipped pages', () => {
    expect(getRouteTitle('/competitions/euro/2028/original')).toBe(NOT_FOUND)
    expect(getRouteTitle('/predict')).toBe(NOT_FOUND)
    expect(getRouteTitle('/games/lms')).toBe(NOT_FOUND)
    expect(getRouteTitle('/match/R16-1')).toBe(NOT_FOUND)
  })
})
