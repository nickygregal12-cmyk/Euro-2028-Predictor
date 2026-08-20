import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { declaredRoutes } from './declaredRoutes'
import { at } from '../support/indexed'

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const axeSource = read('e2e/axe-accessibility.spec.ts')
const axeUnauthenticatedSource = read('e2e/axe-unauthenticated.spec.ts')

const scannedRoutes = [axeSource, axeUnauthenticatedSource].flatMap((source) =>
  [...source.matchAll(/^\s*'(\/[^']*)',$/gm)].map((match) => at(match, 1)),
)

const inJourneyScannedRoutes = readdirSync(resolve(repositoryRoot, 'e2e'))
  .filter((entry) => entry.endsWith('.spec.ts'))
  .flatMap((entry) => [
    ...read(`e2e/${entry}`).matchAll(/expectNoSeriousAxeViolations\(\s*page,\s*'([^']+)'/g),
  ])
  .map((match) => at(match, 1))

/**
 * Parameterised weekly routes are accounted for here until the E2E harness has
 * concrete domestic-season fixtures for each destination. Redirect-only
 * compatibility paths are also explicit: axe scans their canonical target,
 * while route tests prove the redirect itself.
 */
const DEFERRED: ReadonlyArray<readonly [route: string, reason: string]> = [
  ['/admin', 'redirect only — /admin/results is the actual administrator surface'],
  ['/fixtures', 'compatibility redirect only — canonical /matches is axe-scanned directly'],
  ['/league', 'compatibility redirect only — canonical /leagues is axe-scanned directly'],
  ['/more/points', 'compatibility redirect only — canonical /profile is axe-scanned directly'],
  [
    '/competitions/:competitionSlug/:seasonSlug',
    'parameterised competition route — concrete domestic season coverage remains harness work',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/play',
    'parameterised competition route — concrete domestic season coverage remains harness work',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/games/create',
    'parameterised competition route — the create corridor is axe-scanned in Storybook, where its three steps can each be reached without creating anything on a real season',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/matches',
    'parameterised competition route — concrete domestic season coverage remains harness work',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/games',
    'parameterised competition route — concrete domestic season coverage remains harness work',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/games/match-predictor',
    'feature-gated parameterised Match Predictor route needs a seeded domestic entry in the E2E harness',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/games/match-predictor/standings',
    'parameterised Match Predictor standings route needs the seeded domestic Match Predictor harness',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/games/lms',
    'parameterised domestic game route — concrete season coverage remains harness work',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/games/championship/*',
    'parameterised Championship route family — concrete private-instance season coverage remains harness work',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/leagues',
    'parameterised competition route — concrete domestic season coverage remains harness work',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/matches/:fixtureId',
    'parameterised Match Centre route — a concrete fixture id needs the seeded domestic season harness',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/players/:playerId',
    'parameterised season player profile — a concrete co-member id needs the seeded domestic league harness',
  ],
  [
    '/competitions/:competitionSlug/:seasonSlug/tv',
    'parameterised Matchday TV screen — concrete domestic season coverage remains harness work',
  ],
]

const deferredRoutes = DEFERRED.map(([route]) => route)
const allScannedRoutes = [...scannedRoutes, ...inJourneyScannedRoutes]

describe('axe scan coverage', () => {
  it('parses both sides, so the comparison is not vacuous', () => {
    expect(declaredRoutes.length).toBeGreaterThan(20)
    expect(scannedRoutes.length).toBeGreaterThan(10)
    expect(inJourneyScannedRoutes.length).toBeGreaterThan(7)
    expect(inJourneyScannedRoutes.every((route) => route.startsWith('/'))).toBe(true)
  })

  it('accounts for every declared route as scanned or deliberately deferred', () => {
    const unaccounted = declaredRoutes.filter(
      (route) => !allScannedRoutes.includes(route) && !deferredRoutes.includes(route),
    )

    expect(
      unaccounted,
      `these routes are declared in src/App.tsx but neither scanned nor deferred: ${unaccounted.join(', ')}`,
    ).toEqual([])
  })

  it('keeps the deferral list honest — nothing deferred is also scanned', () => {
    const contradictory = deferredRoutes.filter((route) => allScannedRoutes.includes(route))
    expect(contradictory, 'deferred routes that are actually scanned').toEqual([])
  })

  it('keeps the deferral list honest — nothing deferred has been deleted', () => {
    const orphaned = deferredRoutes.filter((route) => !declaredRoutes.includes(route))
    expect(orphaned, 'deferrals for routes no longer declared in App.tsx').toEqual([])
  })

  it('gives every deferral a reason', () => {
    for (const [route, reason] of DEFERRED) {
      expect(reason.length, `${route} is deferred without a reason`).toBeGreaterThan(15)
    }
  })

  it('records that the scan is a real gate rather than a report', () => {
    for (const source of [axeSource, axeUnauthenticatedSource]) {
      expect(source).toMatch(/wcag2a/)
      expect(source).toMatch(/critical/)
      expect(source).toMatch(/expect\(failing/)
    }
  })

  it('counts the findings axe could not decide, in both specs', () => {
    for (const source of [axeSource, axeUnauthenticatedSource]) {
      expect(source).toMatch(/\.\.\.results\.incomplete/)
    }
  })
})
