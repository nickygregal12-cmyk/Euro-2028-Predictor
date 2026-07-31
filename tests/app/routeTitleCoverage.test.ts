import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getRouteTitle } from '../../src/app/RouteAccessibility'

/**
 * Every declared route gets a title of its own.
 *
 * `RouteAccessibility` sets `document.title` and announces "<title> page loaded"
 * into a live region on every client-side navigation. The title comes from a
 * hand-written list, and `getRouteTitle` falls back to `'Page not found'` when
 * nothing matches.
 *
 * That fallback is right for an unknown URL and wrong for a route the
 * application declares: the page renders perfectly, and a screen-reader user is
 * told it was not found. Nothing related the list to `src/App.tsx`, so on 31
 * July 2026 ten routes were in exactly that state — the whole Bonus Games
 * section, `/prediction-trends`, `/profile/:playerId` and all three `/admin`
 * surfaces.
 *
 * The check is behavioural rather than a list comparison, because the list is
 * order-sensitive: `getRouteTitle` returns the first `matchPath` hit. Matching
 * uses `end: true`, so a prefix cannot swallow a longer path — `/games` never
 * matches `/games/lms`. What can swallow is a *parameterised* route above a
 * concrete sibling, because `:id` matches any single segment: moving
 * `/league/:id` above `/league/overall` retitles the standings page "League
 * details" with both entries present and a list diff clean. Calling the
 * function on a concrete path catches the omission and that collision together.
 *
 * `axeRouteCoverage.test.ts` reads `App.tsx` the same way and for the same
 * reason.
 */

const repositoryRoot = process.cwd()
const appSource = readFileSync(resolve(repositoryRoot, 'src/App.tsx'), 'utf8')

/** `/dev/*` is DEV-gated and `*` is the not-found route, as elsewhere. */
const declaredRoutes = [...appSource.matchAll(/<Route path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((path) => path !== '*' && !path.startsWith('/dev/'))

/**
 * Routes that render `<Navigate>` and nothing else.
 *
 * They have no page of their own, so sharing a title with their destination is
 * the truth rather than a shadow. Read from `App.tsx` rather than listed here:
 * the first version hard-coded `/admin` and the collision check then caught
 * `/more/points`, which is the same thing and was equally correct. Exempting
 * the property instead of the example is what stops that recurring.
 */
const redirectRoutes = [
  ...appSource.matchAll(/<Route path="([^"]+)" element=\{<Navigate/g),
].map((match) => match[1])

/** A concrete path for a declared pattern — the parameter value is arbitrary. */
const SAMPLE_PARAMS: Record<string, string> = {
  letter: 'A',
  code: 'ABC123',
  id: '42',
  rivalId: '42',
  matchRef: 'R16-1',
  playerId: '42',
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
    // The fallback has a job; this keeps it doing it. Without this the whole
    // file would pass if `getRouteTitle` returned a constant.
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
        `not-found title, so the browser tab reads "Page not found" and a ` +
        `screen reader is told the page does not exist: ${untitled.join(', ')}`,
    ).toEqual([])
  })

  it('gives each route its own title rather than a parameterised sibling', () => {
    // The shadowing case: `/league/overall` resolving to "League details"
    // because `/league/:id` sits above it. That passes the assertion above
    // while being wrong, and reordering the list is all it takes.
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

  it('names the pages it titles', () => {
    // Spot-checks against what each page actually renders as its heading, so a
    // plausible-but-wrong title is caught. These were the ten added on 31 July
    // 2026, every one of which previously read "Page not found".
    expect(getRouteTitle('/games')).toBe('Bonus Games')
    expect(getRouteTitle('/games/lms')).toBe('Last Man Standing')
    expect(getRouteTitle('/games/cup')).toBe('Predictor Cup')
    expect(getRouteTitle('/games/ko-predictor')).toBe('KO Predictor')
    expect(getRouteTitle('/games/knockout')).toBe('Knockout predictions')
    expect(getRouteTitle('/prediction-trends')).toBe('Prediction trends')
    expect(getRouteTitle('/profile/42')).toBe('Player profile')
    expect(getRouteTitle('/admin/results')).toBe('Results Centre')
    expect(getRouteTitle('/admin/users')).toBe('Users')
  })
})
