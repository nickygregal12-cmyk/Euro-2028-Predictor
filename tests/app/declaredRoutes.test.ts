import { describe, expect, it } from 'vitest'
import { declaredRoutes, redirectRoutes, routePaths } from './declaredRoutes'

/**
 * The parser three coverage guards depend on, against the way it used to fail.
 *
 * A guard that reads a file with a regex has two ways to go wrong: it can match
 * the wrong thing, or it can silently match less than it should. The second is
 * far more dangerous here, because every one of the guards built on this parser
 * reports "no gaps" when it sees no routes at all. The assertions below are
 * about that: a wrapped declaration must be found, and the parser must not be
 * quietly returning nothing.
 */

const WRAPPED = `
  <Route path="/single-line" element={<A />} />
  <Route
    path="/wrapped"
    element={<B />}
  />
  <Route
    path="/wrapped-redirect"
    element={<Navigate to="/single-line" replace />}
  />
`

describe('the route parser', () => {
  it('finds a declaration whether or not Prettier wrapped it', () => {
    expect(routePaths(WRAPPED)).toEqual(['/single-line', '/wrapped', '/wrapped-redirect'])
  })

  it('does not attribute a following route’s path to the current one', () => {
    expect(routePaths('<Route element={<Navigate to="/elsewhere" />} />')).toEqual([])
  })

  it('recognises a wrapped redirect-only route', () => {
    expect(
      [...WRAPPED.matchAll(/<Route\b[^>]*?\bpath="([^"]+)"[^>]*?element=\{<Navigate/g)].map(
        (match) => match[1],
      ),
    ).toEqual(['/wrapped-redirect'])
  })
})

describe('what it finds in the real App.tsx', () => {
  it('is not vacuous', () => {
    expect(declaredRoutes.length).toBeGreaterThan(20)
    expect(redirectRoutes.length).toBeGreaterThan(0)
  })

  it('includes wrapped canonical competition routes', () => {
    expect(declaredRoutes).toContain('/competitions/:competitionSlug/:seasonSlug')
    expect(declaredRoutes).toContain(
      '/competitions/:competitionSlug/:seasonSlug/games/match-predictor',
    )
    expect(declaredRoutes).toContain('/competitions/:competitionSlug/:seasonSlug/games/lms')
    expect(declaredRoutes).toContain(
      '/competitions/:competitionSlug/:seasonSlug/games/championship/*',
    )
  })

  it('does not restore the retired domestic route aliases', () => {
    expect(declaredRoutes).not.toContain(
      '/competitions/:competitionSlug/:seasonSlug/main-predictor',
    )
    expect(declaredRoutes).not.toContain(
      '/competitions/:competitionSlug/:seasonSlug/last-man-standing',
    )
    expect(declaredRoutes).not.toContain('/competitions/:competitionSlug/:seasonSlug/championship')
  })

  it('excludes the DEV previews and the catch-all', () => {
    expect(declaredRoutes.some((route) => route.startsWith('/dev/'))).toBe(false)
    expect(declaredRoutes).not.toContain('*')
  })
})
