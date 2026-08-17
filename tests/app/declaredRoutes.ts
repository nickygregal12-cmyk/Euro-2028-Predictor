import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { weeklyRoutePatterns, weeklyRoutes } from '../../src/app/shellRoutes'
import { at } from '../support/indexed'

/**
 * The routes `src/App.tsx` declares, read once for every guard that needs them.
 *
 * The parser intentionally understands both literal paths and the two approved
 * weekly route authorities. This lets App.tsx consume the typed route constants
 * directly without making the coverage guards blind to those registrations.
 */

const repositoryRoot = process.cwd()

export const appSource = readFileSync(resolve(repositoryRoot, 'src/App.tsx'), 'utf8')

const routeAuthorities = {
  weeklyRoutes,
  weeklyRoutePatterns,
} as const

type RouteAuthorityName = keyof typeof routeAuthorities

function openingRouteTags(source: string): string[] {
  return [...source.matchAll(/<Route\b[^>]*?>/g)].map((match) => at(match, 0))
}

function routePathFromTag(tag: string): string | null {
  const literal = tag.match(/\bpath="([^"]+)"/)
  if (literal?.[1]) return literal[1]

  const authority = tag.match(/\bpath=\{(weeklyRoutes|weeklyRoutePatterns)\.([A-Za-z0-9_]+)\}/)
  if (!authority?.[1] || !authority[2]) return null

  const authorityName = authority[1] as RouteAuthorityName
  const values = routeAuthorities[authorityName] as Record<string, string>
  return values[authority[2]] ?? null
}

/** Every registered `<Route path=...>` resolved to its actual route pattern. */
export function routePaths(source: string): string[] {
  return openingRouteTags(source)
    .map(routePathFromTag)
    .filter((path): path is string => path !== null)
}

/**
 * Application routes: `/dev/*` previews are DEV-only and `*` is the SPA's own
 * not-found route rather than a real navigable path.
 */
export const declaredRoutes = routePaths(appSource).filter(
  (path) => path !== '*' && !path.startsWith('/dev/'),
)

/** Routes whose element is `<Navigate>` and nothing else. */
export const redirectRoutes = openingRouteTags(appSource)
  .filter((tag) => /\belement=\{<Navigate\b/.test(tag))
  .map(routePathFromTag)
  .filter((path): path is string => path !== null)
