import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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
 * `spaRoutingStatus.test.ts` parses `App.tsx` the same way and for the same
 * reason; this reuses that convention rather than inventing a second one.
 */

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const appSource = read('src/App.tsx')
const axeSource = read('e2e/axe-accessibility.spec.ts')
const axeUnauthenticatedSource = read('e2e/axe-unauthenticated.spec.ts')

/**
 * Routes declared in `src/App.tsx`.
 *
 * `/dev/*` previews are `import.meta.env.DEV`-gated and absent from a production
 * build; `*` is the SPA's own not-found route rather than a real path. Both
 * exclusions match `spaRoutingStatus.test.ts`.
 */
const declaredRoutes = [...appSource.matchAll(/<Route path="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((path) => path !== '*' && !path.startsWith('/dev/'))

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
  // `/welcome` sits behind RequireAuth, so it is an *authenticated* route that
  // the scan cannot reach for a different reason: the E2E user has already
  // completed welcome, and RequireWelcome forwards past it. Reaching it needs a
  // fixture user in the pre-welcome state.
  //
  // Corrected 31 July 2026. This entry previously read "unauthenticated —
  // harness auto-logs-in", which was simply wrong about the route.
  ['/welcome', 'authenticated but post-welcome — needs a fixture user who has not completed it'],

  // Parameterised routes need a concrete instance from the seed. `/predict/groups/A`
  // shows the pattern: scan one real instance rather than the template.
  ['/predict/groups/:letter', 'parameterised — /predict/groups/A is scanned in its place'],
  ['/join/:code', 'parameterised — /join/NOSUCH is scanned in its place, in the stale-invite state'],
  ['/league/:id', 'parameterised — needs a seeded league id'],
  ['/match/:matchRef', 'parameterised — needs a seeded match reference'],
  ['/h2h/:rivalId', 'parameterised — needs a seeded rival id'],
  ['/profile/:playerId', 'parameterised — needs a seeded co-member id'],

  // Administrator surfaces require the server-owned `results` capability, which
  // the ordinary E2E user does not hold.
  ['/admin', 'requires the protected administrator capability'],
  ['/admin/results', 'requires the protected administrator capability'],
  ['/admin/users', 'requires the protected administrator capability'],
]

const deferredRoutes = DEFERRED.map(([route]) => route)

describe('axe scan coverage', () => {
  it('parses both sides, so the comparison is not vacuous', () => {
    // Without this a changed `<Route` idiom or a reformatted ROUTES array would
    // empty one side and make every assertion below pass by comparing nothing.
    expect(declaredRoutes.length).toBeGreaterThan(20)
    expect(scannedRoutes.length).toBeGreaterThan(10)
  })

  it('accounts for every declared route as scanned or deliberately deferred', () => {
    const unaccounted = declaredRoutes.filter(
      (route) => !scannedRoutes.includes(route) && !deferredRoutes.includes(route),
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
    const contradictory = deferredRoutes.filter((route) => scannedRoutes.includes(route))

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
})
