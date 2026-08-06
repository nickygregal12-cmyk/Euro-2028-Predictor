import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declaredRoutePaths, productionRoutePaths } from './routeDeclarations'

/**
 * The extractor three controls depend on.
 *
 * The case that matters is the first one: a route wrapped across lines used to
 * be invisible to all three at once, which took a real route's Netlify rewrite,
 * page title and axe scan with it and left the route answering HTTP 404 while
 * rendering perfectly. These assertions exist so that cannot come back quietly.
 */

const appSource = readFileSync(
  resolve(process.cwd(), 'src/App.tsx'),
  'utf8',
)

describe('declaredRoutePaths', () => {
  it('sees a route whose attributes are wrapped across lines', () => {
    // Exactly the shape Prettier produces, and exactly what the old
    // same-line regex could not match.
    const source = `
      <Route
        path="/competitions/:competitionSlug/:seasonSlug"
        element={<CompetitionDashboardPage />}
      />
    `

    expect(declaredRoutePaths(source)).toEqual([
      '/competitions/:competitionSlug/:seasonSlug',
    ])
  })

  it('sees a single-line route too', () => {
    expect(declaredRoutePaths('<Route path="/account" element={<AccountPage />} />')).toEqual([
      '/account',
    ])
  })

  it('does not attribute a later route’s path to an earlier layout route', () => {
    // The failure mode of a lazy cross-line match: `<Route element={...}>`
    // declares no path, and a greedy reader hands it the next route's.
    const source = `
      <Route element={<AuthLayout />}>
        <Route path="/auth/login" element={<LoginPage />} />
      </Route>
    `

    expect(declaredRoutePaths(source)).toEqual(['/auth/login'])
  })

  it('reads the path even when the element contains its own tag', () => {
    const source = `<Route path="/more/points" element={<Navigate to="/profile" replace />} />`

    expect(declaredRoutePaths(source)).toEqual(['/more/points'])
  })

  it('finds every path the real App.tsx declares, wrapped or not', () => {
    // A cross-check against the file itself: `path=` is a Route-only attribute
    // here, so any occurrence the extractor misses is a route a control cannot
    // see. This is the assertion that would have failed before the fix.
    const rawPathCount = [...appSource.matchAll(/\bpath="/g)].length

    expect(declaredRoutePaths(appSource)).toHaveLength(rawPathCount)
  })

  it('excludes the DEV previews and the catch-all from the production set', () => {
    const production = productionRoutePaths(appSource)

    expect(production).not.toContain('*')
    expect(production.some((path) => path.startsWith('/dev/'))).toBe(false)
    expect(production).toContain('/competitions/:competitionSlug/:seasonSlug')
  })
})
