import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appSource, declaredRoutes, redirectRoutes } from './declaredRoutes'
import { ROUTE_OWNERSHIP } from './routeOwnership'
import {
  OUTSIDE_THE_LEGACY_FRAME,
  VNEXT_FRAMED_ROUTES,
} from '../../src/app/vnext/frameOwnership'

/**
 * FOR EVERY USER-FACING ADDRESS, WHICH FRAME OWNS IT?
 *
 * ============================ THE FAILURE THIS EXISTS FOR ================
 *
 * Stage 14 cut nine destinations over and shipped three separate ways for a
 * player to fall back out of the new product without touching a legacy link:
 *
 *   • the Match Predictor's vNext adapter was built, exported, and mounted by
 *     no route at all, so the flagship game served the legacy season page;
 *   • the vNext onboarding and invite surfaces were the same — complete, with
 *     stories and a `/dev` harness, and reachable only from `/dev`;
 *   • every cut-over route stayed wrapped in `AppShell`, so a vNext surface
 *     drew its own navigation inside a retired one.
 *
 * Not one of those was a failing test. Each was found by opening the
 * application and looking. This file is the executable half of
 * `docs/product/vnext-route-migration-matrix.md`, which says in its own words
 * that *"a route left as 'probably covered by Leagues' is exactly how the next
 * Last Man Standing happens"* — and which, being a document, cannot fail a
 * build.
 *
 * ============================ WHAT IT REFUSES TO ASSUME ==================
 *
 * It reads `src/App.tsx` as source and derives what it can. The classification
 * table is the only hand-written part, and every row of it is cross-checked
 * against the tree, so a row cannot be right about a route that changed and a
 * route cannot be added without one.
 */

const OWNED = new Map(ROUTE_OWNERSHIP.map((row) => [row.path, row]))

/** Each route's opening tag plus its element expression, up to the next route. */
function elementSourceFor(path: string): string {
  // The registrations are formatted one per `<Route`, and an element may hold
  // nested JSX — so the span is taken from this route's `path=` to the next
  // `<Route` rather than by trying to balance braces with a regex.
  const literal = `path="${path}"`
  const index = appSource.indexOf(literal)
  const from =
    index >= 0
      ? index
      : (() => {
          // Registered through the route authority rather than as a literal.
          for (const match of appSource.matchAll(
            /path=\{(weeklyRoutes|weeklyRoutePatterns)\.([A-Za-z0-9_]+)\}/g,
          )) {
            const resolved = routeAuthorityValue(match[1] as string, match[2] as string)
            if (resolved === path) return match.index ?? -1
          }
          return -1
        })()
  if (from < 0) return ''
  const next = appSource.indexOf('<Route', from)
  return appSource.slice(from, next > from ? next : appSource.length)
}

function routeAuthorityValue(authority: string, key: string): string | null {
  // Imported lazily through `declaredRoutes`'s own resolution rather than
  // duplicated: this only needs the same answer, not a second copy of it.
  const source = readFileSync('src/app/shellRoutes.ts', 'utf8')
  const block =
    authority === 'weeklyRoutes'
      ? source.slice(source.indexOf('export const weeklyRoutes'))
      : source.slice(source.indexOf('export const weeklyRoutePatterns'))
  const match = block.match(new RegExp(`\\b${key}:\\s*'([^']+)'`))
  return match?.[1] ?? null
}

describe('every user-facing address carries an explicit owner', () => {
  it('parses the route tree at all, so a silent parse failure cannot pass', () => {
    // Without this, a parser that found nothing would satisfy every assertion
    // below by having nothing to check.
    expect(declaredRoutes.length).toBeGreaterThanOrEqual(35)
    expect(declaredRoutes).toContain('/')
    expect(declaredRoutes).toContain('/competitions/:competitionSlug/:seasonSlug')
  })

  it('classifies every route the application registers', () => {
    // A NEW ROUTE WITHOUT A ROW IS THE DEFECT THIS CATCHES. Naming it in the
    // failure rather than counting, because the fix is to add the exact row the
    // message prints — and to think about which owner it is while doing so.
    const unclassified = declaredRoutes.filter((path) => !OWNED.has(path))
    expect(unclassified).toEqual([])
  })

  it('names no address the application does not register', () => {
    const stale = ROUTE_OWNERSHIP.map((row) => row.path).filter(
      (path) => !declaredRoutes.includes(path),
    )
    expect(stale).toEqual([])
  })

  it('gives every row a reason somebody wrote down', () => {
    const silent = ROUTE_OWNERSHIP.filter((row) => row.why.trim().length < 20).map(
      (row) => row.path,
    )
    expect(silent).toEqual([])
  })
})

describe('the classification agrees with what the route tree actually does', () => {
  it('calls a route a redirect exactly when its element is one', () => {
    const declaredRedirects = ROUTE_OWNERSHIP.filter((row) => row.owner === 'redirect').map(
      (row) => row.path,
    )
    expect([...declaredRedirects].sort()).toEqual([...redirectRoutes].sort())
  })

  it('gates every vNext and absorbed route on the journey its row names', () => {
    // The row's flag has to be the flag the route branches on. A row claiming
    // `footballHubMatches` for a route gated on Home would make the rollback
    // table a work of fiction — and rollback is a release gate.
    const wrong: string[] = []
    for (const row of ROUTE_OWNERSHIP) {
      if (row.journey === null) continue
      const element = elementSourceFor(row.path)
      if (!element.includes(`isNextUi('${row.journey}')`)) {
        wrong.push(`${row.path} is not gated on ${row.journey}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('resolves every absorbed address rather than rendering a second product at it', () => {
    // ABSORBED MEANS THE ADDRESS SURVIVES AND THE PAGE DOES NOT. A row that
    // said `absorbed` while still rendering the legacy surface would be the
    // exact state this stage exists to end: a complete parallel product in the
    // retired design, one press away from anything that still links to it.
    const notResolving: string[] = []
    for (const row of ROUTE_OWNERSHIP) {
      if (row.owner !== 'absorbed') continue
      const element = elementSourceFor(row.path)
      if (!/<Absorbed\.[A-Za-z]+\b/.test(element)) notResolving.push(row.path)
    }
    expect(notResolving).toEqual([])
  })

  it('keeps every absorbed address a rollback away from its legacy page', () => {
    // The legacy element stays mounted and is handed to the resolver, so
    // turning the absorbing destination's flag off restores the old page — and
    // so does a build that does not serve the domestic tree.
    const noFallback: string[] = []
    for (const row of ROUTE_OWNERSHIP) {
      if (row.owner !== 'absorbed') continue
      if (!/legacy=\{</.test(elementSourceFor(row.path))) noFallback.push(row.path)
    }
    expect(noFallback).toEqual([])
  })

  it('classifies the frame of every flag-gated vNext route', () => {
    // A vNext surface renders `VNextShell`. If `AppShell` also wraps it the
    // player gets two navigations, and the outer one draws tabs the route
    // matrix retires. Either the route is in the frame table, or it is one of
    // the addresses registered outside `AppShell` entirely.
    const framed = new Set(VNEXT_FRAMED_ROUTES.map((route) => route.pattern))
    const outside = new Set(OUTSIDE_THE_LEGACY_FRAME)

    const unframed = ROUTE_OWNERSHIP.filter(
      (row) =>
        row.owner === 'vnext' &&
        row.journey !== null &&
        !framed.has(row.path) &&
        !outside.has(row.path),
    ).map((row) => row.path)

    expect(unframed).toEqual([])
  })

  it('leaves the matchday television screen outside the signed-in frame', () => {
    // INNOV-006, and the one row where "legacy" is a product decision rather
    // than unfinished work: a room display with a bottom navigation bar is the
    // wrong product, and Stage 8 deferred its redesign deliberately.
    const tv = OWNED.get('/competitions/:competitionSlug/:seasonSlug/tv')
    expect(tv?.owner).toBe('legacy-permanent')
    expect(VNEXT_FRAMED_ROUTES.some((route) => route.pattern.endsWith('/tv'))).toBe(false)
  })
})

describe('no cutover flag and no vNext surface is stranded', () => {
  it('has a route consuming every Football Hub cutover flag', () => {
    // A FLAG WITH NO CONSUMER IS A DESTINATION NOBODY CAN REACH, which is
    // precisely what `footballHubPredictor`'s absence was before it existed:
    // the adapter shipped, and the only thing missing was a route.
    const journeys = [
      ...new Set(
        [...appSource.matchAll(/isNextUi\('(footballHub[A-Za-z]+)'\)/g)].map(
          (match) => match[1] as string,
        ),
      ),
    ]
    const declared = [
      ...new Set(
        [
          ...readFileSync('src/app/routeFlags.ts', 'utf8').matchAll(
            /case '(footballHub[A-Za-z]+)':/g,
          ),
        ].map((match) => match[1] as string),
      ),
    ]

    expect(declared.length).toBeGreaterThanOrEqual(9)
    const unconsumed = declared.filter((journey) => !journeys.includes(journey))
    expect(unconsumed, 'these cutover flags exist and no route consumes them').toEqual([])
  })

  it('mounts every connected vNext surface somewhere that is not /dev', () => {
    // THE MATCH PREDICTOR DEFECT, AS A TEST. `VNextPredictorScreen` existed,
    // was exported, had an adapter, and was reachable only from a development
    // harness — so the flagship game kept serving the legacy page while every
    // destination around it had moved. Onboarding and the invite were in the
    // same position. A screen that only `/dev` can reach is not shipped.
    const screens = readdirSync('src/vnext/integration', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) =>
        readdirSync(`src/vnext/integration/${entry.name}`)
          .filter((file) => /^VNext.*Screen\.tsx$/.test(file))
          .map((file) => file.replace(/\.tsx$/, '')),
      )

    expect(screens.length).toBeGreaterThanOrEqual(12)

    const production = productionSources()
    const stranded = screens.filter(
      (screen) => !production.some((source) => source.includes(screen)),
    )

    expect(stranded, 'these vNext surfaces are reachable only from /dev').toEqual([])
  })
})

/**
 * Every source file the shipped application can reach — which is everything
 * under `src/` except the development harnesses, the stories and the lane the
 * screens themselves live in.
 */
function productionSources(): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        if (path === 'src/dev' || path === 'src/vnext/stories') continue
        if (path === 'src/vnext/integration') continue
        walk(path)
        continue
      }
      if (/\.(ts|tsx)$/.test(entry.name)) files.push(readFileSync(path, 'utf8'))
    }
  }
  walk('src')
  return files
}
