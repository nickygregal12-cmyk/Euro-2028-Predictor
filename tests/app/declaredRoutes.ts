import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The routes `src/App.tsx` declares, read once for every guard that needs them.
 *
 * WHY THIS EXISTS. Three separate guards — route titles, axe scan coverage and
 * Netlify SPA status — each related their own list back to `App.tsx` with their
 * own copy of `/<Route path="([^"]+)"/g`. That regex requires `<Route` and
 * `path=` on the SAME LINE, and Prettier does not: a route with a long path or
 * an `element` that does not fit wraps onto several lines. Every such route was
 * invisible to all three guards at once, which is the worst possible failure
 * for a control whose entire job is to notice omissions.
 *
 * It was not hypothetical. `/competitions/:competitionSlug/:seasonSlug` is
 * wrapped, so it had no Netlify redirect: Netlify answered the competition
 * dashboard with the catch-all's **404** while the SPA rendered the page
 * perfectly. That is precisely the soft-status inversion `spaRoutingStatus`
 * was written to prevent, and it sat inside the guard's blind spot.
 *
 * So the idiom is parsed in one place, formatting-independent, with positive
 * controls in `declaredRoutes.test.ts` proving it sees a wrapped declaration.
 * The three guards keep their own reasoning and their own assertions; what they
 * stop keeping is three chances to mis-parse the same file.
 */

const repositoryRoot = process.cwd()

export const appSource = readFileSync(resolve(repositoryRoot, 'src/App.tsx'), 'utf8')

/**
 * Every `path` attribute on a `<Route>`, regardless of line breaks.
 *
 * `[^>]*?` spans newlines but not the end of the opening tag, so a `path` in a
 * following element cannot be attributed to this one. `path` precedes `element`
 * in every declaration, which is what makes stopping at `>` safe.
 */
export function routePaths(source: string): string[] {
  return [...source.matchAll(/<Route\b[^>]*?\bpath="([^"]+)"/g)].map((match) => match[1])
}

/**
 * Application routes: `/dev/*` previews are `import.meta.env.DEV`-gated and
 * absent from a production build, and `*` is the SPA's own not-found route
 * rather than a real path. Both exclusions are shared by all three guards.
 */
export const declaredRoutes = routePaths(appSource).filter(
  (path) => path !== '*' && !path.startsWith('/dev/'),
)

/**
 * Routes whose element is `<Navigate>` and nothing else.
 *
 * They have no page of their own, so sharing a title with their destination is
 * the truth rather than a shadow.
 */
export const redirectRoutes = [
  ...appSource.matchAll(/<Route\b[^>]*?\bpath="([^"]+)"[^>]*?element=\{<Navigate/g),
].map((match) => match[1])
