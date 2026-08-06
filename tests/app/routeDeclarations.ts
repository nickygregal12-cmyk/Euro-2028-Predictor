/**
 * The one place `src/App.tsx`'s declared routes are read from.
 *
 * WHY THIS EXISTS, AND WHAT IT COST TO NOT HAVE IT. Three separate controls —
 * SPA routing status, route titles and axe coverage — each carried their own
 * copy of `/<Route path="([^"]+)"/g`, which only matches when `<Route` and
 * `path=` land on the SAME LINE. Prettier wraps a long route across lines, and
 * the moment it did, all three controls stopped seeing that route at once:
 *
 *   <Route
 *     path="/competitions/:competitionSlug/:seasonSlug"
 *     element={<CompetitionDashboardPage />}
 *   />
 *
 * React knew about the route and served it. The route checks did not, so
 * `netlify.toml` was never required to hold a 200 rewrite for it, and the
 * catch-all answered **HTTP 404 while the page rendered normally**. A visual
 * check cannot see that: the page looks right, and only crawlers, monitoring,
 * link previews and SEO reporting see the 404.
 *
 * HOW IT READS THEM. Splitting on `<Route` puts each declaration at the start
 * of a segment, and the path is taken from the segment's opening tag only —
 * the text before its first `>`. That tolerates any attribute wrapping without
 * ever crossing into the next route, which a lazy `[\s\S]*?` match would do
 * whenever a `<Route>` without a path (a layout route) preceded one with it.
 *
 * A ROUTE WITHOUT A PATH IS NOT A GAP. Layout routes (`<Route element={...}>`)
 * declare no path by design and are simply absent from the result.
 */

export function declaredRoutePaths(appSource: string): string[] {
  const paths: string[] = []

  // The first segment is everything before the first `<Route`, so it is skipped.
  for (const segment of appSource.split('<Route').slice(1)) {
    const openingTag = segment.slice(0, segment.indexOf('>'))
    const match = /\bpath="([^"]+)"/.exec(openingTag)
    if (match) paths.push(match[1])
  }

  return paths
}

/**
 * The routes a production build actually serves.
 *
 * `/dev/*` previews are `import.meta.env.DEV`-gated and absent from a
 * production bundle; `*` is the SPA's own not-found route rather than a path.
 * Every control excludes exactly these two, so the exclusion lives here too.
 */
export function productionRoutePaths(appSource: string): string[] {
  return declaredRoutePaths(appSource).filter(
    (path) => path !== '*' && !path.startsWith('/dev/'),
  )
}
