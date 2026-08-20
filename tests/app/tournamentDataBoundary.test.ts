import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { weeklyRoutePatterns, weeklyRoutes } from '../../src/app/shellRoutes'
import { appSource } from './declaredRoutes'
import { reachableFrom, resolveSpecifier } from './importGraph'

/**
 * Which routes mount the Euro tournament's data, checked against which routes
 * actually need it.
 *
 * The providers used to sit above the entire signed-in shell, so every player
 * fetched the whole Euro dataset on every page load — including the ones who
 * follow a domestic season and can reach no Euro surface at all. They now mount
 * as a route layout (`TournamentJourney`) wrapping exactly the consuming routes.
 *
 * A COMMENT WOULD NOT HOLD THAT. The failure modes are silent in both
 * directions: a consumer registered outside the boundary throws only when
 * someone navigates to it, and a route moved inside it that needs nothing
 * quietly puts the fetch back on a domestic journey. So this walks the real
 * import graph from each registered route rather than trusting a list.
 */

const repositoryRoot = process.cwd()

const PROVIDER_MODULES = [
  'src/app/providers/TournamentDataProvider.tsx',
  'src/app/providers/PredictionsProvider.tsx',
] as const

/**
 * Every route element `App.tsx` can name, paired with the module it comes from.
 *
 * TWO FORMS, AND THE SECOND ONE IS WHY THIS COMMENT EXISTS. Almost every page is
 * `const HubPage = lazy(() => import('./features/hub/HubPage')…`, and for a long
 * time that was the only form. ADR 0026's variant destinations are statically
 * imported instead — deliberately, because making the dispatcher lazy would put a
 * second sequential dynamic import on the critical path of the signed-in home —
 * and a parser that only understood the lazy form dropped `/` out of this guard's
 * analysis entirely. It did not fail; it silently stopped checking the home page,
 * which is the one route the assertions below name explicitly.
 *
 * So both forms are read. Over-reading is safe here: an element name that is not
 * a route element resolves to a module nobody asks about.
 */
function routeElementModules(source: string): Map<string, string> {
  const modules = new Map<string, string>()

  for (const match of source.matchAll(/const (\w+) = lazy\(\(\) =>\s*\n?\s*import\('([^']+)'\)/g)) {
    const [, name, specifier] = match
    if (name && specifier) modules.set(name, specifier)
  }

  // `import { HomeDestination, PlayDestination } from './app/destinations/…'`
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g)) {
    const [, names, specifier] = match
    if (!names || !specifier) continue
    for (const raw of names.split(',')) {
      const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim()
      if (name) modules.set(name, specifier)
    }
  }

  return modules
}

type RouteTag = { tag: string; selfClosing: boolean; closing: boolean }

/**
 * `<Route …>` tags, scanned rather than matched.
 *
 * A REGEX GETS THIS WRONG, and the first version of this file proved it.
 * `element={<AdminLayout />}` contains a `>` inside the attribute, so
 * `/<Route\b[^>]*?>/` ends the tag early and every layout route reads as
 * self-closing — which made the nesting depth flat and reported every route as
 * outside the boundary. So the scanner tracks brace depth and ends the tag at
 * the first `>` that is not inside an expression container.
 */
function routeTags(source: string): RouteTag[] {
  const tags: RouteTag[] = []

  for (const match of source.matchAll(/<\/?Route\b/g)) {
    const start = match.index
    let braces = 0
    let end = -1

    for (let i = start; i < source.length; i += 1) {
      const character = source[i]
      if (character === '{') braces += 1
      else if (character === '}') braces -= 1
      else if (character === '>' && braces === 0) {
        end = i
        break
      }
    }
    if (end === -1) continue

    const tag = source.slice(start, end + 1)
    tags.push({
      tag,
      selfClosing: /\/\s*>$/.test(tag),
      closing: tag.startsWith('</'),
    })
  }

  return tags
}

const ROUTE_AUTHORITIES: Record<string, Record<string, string>> = {
  weeklyRoutes,
  weeklyRoutePatterns,
}

function pathOf(tag: string): string | null {
  const literal = tag.match(/\bpath="([^"]+)"/)?.[1]
  if (literal) return literal
  // The canonical weekly routes are registered from the typed authority, so the
  // tag carries a member expression rather than a string.
  const authority = tag.match(/\bpath=\{(weeklyRoutes|weeklyRoutePatterns)\.(\w+)\}/)
  if (!authority?.[1] || !authority[2]) return null
  return ROUTE_AUTHORITIES[authority[1]]?.[authority[2]] ?? null
}

/**
 * EVERY element a route can render, not the first one.
 *
 * A flag-gated route is `element={isNextUi('x') && A ? <A /> : <B />}`, so the
 * old `element={<Word` match found nothing at all and the route vanished from
 * this analysis entirely. That is the worst outcome available: a route behind a
 * flag is exactly the kind a boundary rule needs to see, and dropping it made
 * this suite quietly stop measuring the Football Hub cutover's nine
 * destinations the moment they were gated.
 *
 * So both branches are collected and both are analysed. A route that reaches
 * the tournament data through EITHER of its two elements fails, which is the
 * only reading that is true of a switch.
 */
function elementsOf(tag: string): string[] {
  const at = tag.indexOf('element={')
  if (at < 0) return []
  const attribute = tag.slice(at)
  return [...new Set([...attribute.matchAll(/<(\w+)/g)].map((match) => match[1] ?? ''))].filter(
    Boolean,
  )
}

/**
 * Every route with a page element, paired with whether it is nested inside the
 * `TournamentJourney` layout. Depth is counted over real tags rather than
 * matched with a regex, because a self-closing `<Route … />` has no closer and
 * counting `</Route>` alone drifts by one at the first of them.
 */
function routesByBoundary(source: string): { element: string; path: string; inside: boolean }[] {
  const routes: { element: string; path: string; inside: boolean }[] = []
  let depth = 0
  let boundaryDepth: number | null = null

  for (const { tag, selfClosing, closing } of routeTags(source)) {
    if (closing) {
      depth -= 1
      if (boundaryDepth !== null && depth < boundaryDepth) boundaryDepth = null
      continue
    }

    const elements = elementsOf(tag)
    const path = pathOf(tag)
    if (path) {
      for (const element of elements) {
        routes.push({ element, path, inside: boundaryDepth !== null })
      }
    }

    if (!selfClosing) {
      if (elements.includes('TournamentJourney') && boundaryDepth === null) {
        boundaryDepth = depth + 1
      }
      depth += 1
    }
  }

  return routes
}

/** Whether a module reaches either provider through its own import graph. */
function reachesTournamentData(entry: string): boolean {
  const targets = PROVIDER_MODULES.map((path) => resolve(repositoryRoot, path))
  const graph = reachableFrom(entry)
  return targets.some((target) => graph.has(target))
}

const modules = routeElementModules(appSource)
const routes = routesByBoundary(appSource)

const analysed = routes
  .map((route) => {
    const specifier = modules.get(route.element)
    if (!specifier) return null
    const file = resolveSpecifier(resolve(repositoryRoot, 'src/App.tsx'), specifier)
    if (!file) return null
    return { ...route, file: relative(repositoryRoot, file), needs: reachesTournamentData(file) }
  })
  .filter((route): route is NonNullable<typeof route> => route !== null)

describe('the tournament-data boundary', () => {
  it('parses App.tsx, so the comparison is not vacuous', () => {
    // A regex that silently matches nothing would make every assertion below
    // pass over an empty set, which is the failure this file exists to avoid.
    expect(modules.size).toBeGreaterThan(15)
    expect(analysed.length).toBeGreaterThan(15)
    expect(analysed.some((route) => route.inside)).toBe(true)
    expect(analysed.some((route) => !route.inside)).toBe(true)
    // Named, because the home page is the route the domestic assertion below
    // depends on and the one a parser gap dropped once already.
    expect(analysed.map((route) => route.path)).toContain('/')
  })

  it('mounts the providers in exactly one place', () => {
    for (const provider of ['TournamentDataProvider', 'PredictionsProvider']) {
      expect(appSource, `App.tsx mounts ${provider} directly`).not.toContain(`<${provider}`)
    }
    const journey = readFileSync(resolve(repositoryRoot, 'src/app/TournamentJourney.tsx'), 'utf8')
    expect(journey).toContain('<TournamentDataProvider>')
    expect(journey).toContain('<PredictionsProvider>')
    expect(
      readFileSync(resolve(repositoryRoot, 'src/app/Providers.tsx'), 'utf8'),
      'RequireAuth still mounts the tournament providers above the whole shell',
    ).not.toContain('TournamentDataProvider')
  })

  it('never registers a tournament consumer outside the boundary', () => {
    // This is the crash case: `useTournamentData` throws on mount without its
    // provider, so the route is a white screen for whoever opens it.
    const stranded = analysed.filter((route) => route.needs && !route.inside)
    expect(
      stranded.map((route) => `${route.path} (${route.file})`),
      'these routes read tournament data with no provider above them',
    ).toEqual([])
  })

  it('never puts the tournament fetch on a route that does not read it', () => {
    // The quiet case, and the one the boundary exists for: a domestic journey
    // moved inside pays for the whole Euro dataset on every load and every
    // return to the foreground, for data it never renders.
    const gratuitous = analysed.filter((route) => route.inside && !route.needs)
    expect(
      gratuitous.map((route) => `${route.path} (${route.file})`),
      'these routes mount the tournament providers and read nothing from them',
    ).toEqual([])
  })

  it('keeps every domestic surface clear of it', () => {
    // Stated over the weekly feature tree rather than over today's route list,
    // so a season page added tomorrow cannot reach for the tournament without
    // this failing — ADR 0011's separation, at the surface layer.
    const domestic = analysed.filter(
      (route) => route.path === '/' || route.path.startsWith('/competitions/'),
    )
    expect(domestic.length).toBeGreaterThan(5)
    expect(
      domestic.filter((route) => route.needs).map((route) => `${route.path} (${route.file})`),
      'a domestic competition surface reaches the Euro tournament data',
    ).toEqual([])
  })
})
