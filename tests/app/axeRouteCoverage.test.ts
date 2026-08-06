import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declaredRoutes } from './declaredRoutes'

/**
 * Accessibility scan coverage, against the routes the application declares.
 *
 * `e2e/axe-accessibility.spec.ts` is a real control: it runs in CI through
 * `npm run test:e2e`, tags WCAG 2.0/2.1/2.2 A and AA, and fails on serious or
 * critical violations. None of that was in doubt.
 *
 * What was in doubt is *how much of the product it sees*. Nothing related the
 * scanned route list to `src/App.tsx`, so on 31 July 2026 it covered **11 of 34
 * declared routes** — and ten of the twenty-three gaps needed nothing but
 * listing, because the existing authenticated harness already reaches them.
 *
 * A scan that exists, runs, and fails correctly still reports green while two
 * thirds of the product is unexamined. That is the shape this repository keeps
 * finding, so the fix is the same one: relate the control to the thing it
 * claims to cover, and make an omission fail.
 *
 * Every declared route must now be either scanned or listed below as a
 * deliberate deferral with a reason. Adding a route to the app becomes a
 * decision about accessibility cover rather than a silent escape from it.
 *
 * `declaredRoutes.ts` reads `App.tsx` for this guard and for the route-title
 * and Netlify-status guards. It used to be three copies of one regex, and that
 * regex required `<Route path=` on a single line: a wrapped declaration was
 * reported as covered by never being counted at all — the failure mode a
 * coverage guard can least afford, and one that hid both competition routes.
 */

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const axeSource = read('e2e/axe-accessibility.spec.ts')
const axeUnauthenticatedSource = read('e2e/axe-unauthenticated.spec.ts')

/**
 * Route literals across both axe specs.
 *
 * Two specs, because the two harnesses differ: `axe-accessibility` runs signed
 * in, `axe-unauthenticated` runs under `playwright.auth.config.ts` with
 * `VITE_DEV_AUTOLOGIN=false`. Coverage is the union — a route is scanned if
 * either sees it, and reading only one would report the other's routes as gaps.
 */
const scannedRoutes = [axeSource, axeUnauthenticatedSource].flatMap((source) =>
  [...source.matchAll(/^\s*'(\/[^']*)',$/gm)].map((match) => match[1]),
)

/**
 * Routes scanned from inside another journey.
 *
 * The parameterised routes and the administrator surfaces were deferred for
 * needing a seeded id or the `results` capability. That was true of a standalone
 * scan and false of the suite: `profile-h2h-surfaces`, `match-centre-navigation`
 * and `admin-results` already seed those records and already stand on those
 * pages. `e2e/axe-scan.ts` scans wherever the caller has navigated, so the scan
 * goes to the page instead of the page being rebuilt for the scan.
 *
 * Collected from the call sites rather than restated here, so a scan that is
 * added or removed changes this set without anyone maintaining a second list.
 * The argument is the declared pattern from `App.tsx`, not the concrete path.
 */
const inJourneyScannedRoutes = readdirSync(resolve(repositoryRoot, 'e2e'))
  .filter((entry) => entry.endsWith('.spec.ts'))
  .flatMap((entry) => [
    ...read(`e2e/${entry}`).matchAll(/expectNoSeriousAxeViolations\(\s*page,\s*'([^']+)'/g),
  ])
  .map((match) => match[1])

/**
 * Routes deliberately not scanned, each with the reason it cannot be today.
 *
 * These are not excuses — each names a specific harness capability that does not
 * exist yet, so the list is a work queue rather than a permanent exemption.
 *
 * The unauthenticated group left this list on 31 July 2026. Their stated reason
 * — that the harness auto-logs-in — was true of `playwright.config.ts` and not
 * of `playwright.auth.config.ts`, which already serves the app with
 * `VITE_DEV_AUTOLOGIN=false`. They are now scanned by
 * `e2e/axe-unauthenticated.spec.ts`. A deferral reason that names the wrong
 * blocker keeps work parked longer than the blocker justifies.
 */
const DEFERRED: ReadonlyArray<readonly [route: string, reason: string]> = [
  // Parameterised routes need a concrete instance from the seed. `/predict/groups/A`
  // shows the pattern: scan one real instance rather than the template.
  ['/predict/groups/:letter', 'parameterised — /predict/groups/A is scanned in its place'],

  // `/admin` renders no page of its own — it is `<Navigate to="/admin/results"
  // replace />`, so scanning it scans a route that is already covered. The old
  // reason here said it "requires the protected administrator capability",
  // which was the wrong kind of wrong: there is nothing behind it to reach.
  ['/admin', 'redirect only — <Navigate> to /admin/results, which is scanned'],

  // Both competition routes arrived in this list the day the shared route
  // reader replaced three copies of a regex that could not see a wrapped
  // `<Route>`. They were declared all along; nothing here was ever checking
  // them.
  [
    '/competitions/:competitionSlug/:seasonSlug',
    'parameterised — three concrete seasons are scanned in its place, the same ' +
      'arrangement as /predict/groups/:letter',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/main-predictor',
    'VITE_UI_SEASON_MATCH_PREDICTOR is off in the harness, so this route renders ' +
      'the not-found page; and the seeded harness user has no season Match ' +
      'Predictor entry, so with the flag on it would render the entry refusal ' +
      'rather than a card. Scanning it needs the flag set for the E2E dev server ' +
      'and a seeded season entry — both harness work, neither done here',
  ],

  // The three season game surfaces, scanned as concrete instances in
  // `e2e/axe-accessibility.spec.ts` for the same reason as the dashboard above:
  // the guard relates declared patterns to scanned literals and cannot match
  // `premier-league/2026-27` to `:competitionSlug`. Unlike main-predictor these
  // carry no flag and need no seeded entry — they render for any signed-in
  // caller — so the scan is real coverage rather than deferred work.
  [
    '/competitions/:competitionSlug/:seasonSlug/play',
    'parameterised — /competitions/premier-league/2026-27/play is scanned in its place',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/standings',
    'parameterised — /competitions/premier-league/2026-27/standings is scanned in its place',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/last-man-standing',
    'parameterised — /competitions/premier-league/2026-27/last-man-standing is scanned in its place',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/championship',
    'parameterised — /competitions/premier-league/2026-27/championship is scanned in its place',
  ],
]

const deferredRoutes = DEFERRED.map(([route]) => route)

/** A route is covered if either harness sees it, standalone or in a journey. */
const allScannedRoutes = [...scannedRoutes, ...inJourneyScannedRoutes]

describe('axe scan coverage', () => {
  it('parses both sides, so the comparison is not vacuous', () => {
    // Without this a changed `<Route` idiom or a reformatted ROUTES array would
    // empty one side and make every assertion below pass by comparing nothing.
    expect(declaredRoutes.length).toBeGreaterThan(20)
    expect(scannedRoutes.length).toBeGreaterThan(10)
    // The in-journey side has its own idiom and its own way of going quiet: a
    // renamed helper or a call site passing a concrete path would empty it, and
    // every route it covers would silently become a gap.
    expect(inJourneyScannedRoutes.length).toBeGreaterThan(7)
    expect(inJourneyScannedRoutes.every((route) => route.startsWith('/'))).toBe(true)
  })

  it('accounts for every declared route as scanned or deliberately deferred', () => {
    const unaccounted = declaredRoutes.filter(
      (route) => !allScannedRoutes.includes(route) && !deferredRoutes.includes(route),
    )

    expect(
      unaccounted,
      `these routes are declared in src/App.tsx but neither scanned by ` +
        `e2e/axe-accessibility.spec.ts nor deferred here: ${unaccounted.join(', ')}`,
    ).toEqual([])
  })

  it('keeps the deferral list honest — nothing deferred is also scanned', () => {
    // A route that is both deferred and scanned means the deferral is stale and
    // the reason attached to it is no longer true.
    const contradictory = deferredRoutes.filter((route) => allScannedRoutes.includes(route))

    expect(contradictory, 'deferred routes that are actually scanned').toEqual([])
  })

  it('keeps the deferral list honest — nothing deferred has been deleted', () => {
    // A deferral for a route that no longer exists is dead weight that makes the
    // remaining work look larger than it is.
    const orphaned = deferredRoutes.filter((route) => !declaredRoutes.includes(route))

    expect(orphaned, 'deferrals for routes no longer declared in App.tsx').toEqual([])
  })

  it('gives every deferral a reason', () => {
    for (const [route, reason] of DEFERRED) {
      expect(reason.length, `${route} is deferred without a reason`).toBeGreaterThan(15)
    }
  })

  it('records that the scan is a real gate rather than a report', () => {
    // The coverage numbers above only matter because the scan fails the build.
    // If it were ever softened to a warning, this file would be measuring the
    // breadth of something that no longer enforces anything.
    for (const source of [axeSource, axeUnauthenticatedSource]) {
      expect(source).toMatch(/wcag2a/)
      expect(source).toMatch(/critical/)
      expect(source).toMatch(/expect\(failing/)
    }
  })

  it('counts the findings axe could not decide, in both specs', () => {
    // `results.incomplete` is where axe puts what it could not resolve. A scan
    // that reads only `violations` reports clean while holding them, which is
    // how a critical `duplicate-id-aria` and a serious `aria-prohibited-attr`
    // went unreported by the component scan until 31 July 2026.
    //
    // Asserted per spec rather than by sharing a helper: the two specs are
    // near-duplicates on purpose — each is readable alone — so this is what
    // stops them drifting apart on the rule that matters most.
    for (const source of [axeSource, axeUnauthenticatedSource]) {
      expect(source).toMatch(/\.\.\.results\.incomplete/)
    }
  })
})
