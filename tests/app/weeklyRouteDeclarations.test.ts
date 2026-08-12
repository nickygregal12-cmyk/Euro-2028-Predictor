import { describe, expect, it } from 'vitest'
import { weeklyRoutePatterns, weeklyRoutes } from '../../src/app/shellRoutes'
import { declaredRoutes, redirectRoutes } from './declaredRoutes'

const {
  championship: _championshipBuilderBase,
  ...registeredCompetitionPatterns
} = weeklyRoutePatterns

const CANONICAL = [
  ...Object.values(weeklyRoutes),
  ...Object.values(registeredCompetitionPatterns),
] as const

/**
 * The tournament addresses the WEEKLY competition tree must never grow.
 *
 * IT USED TO LIST THE WHOLE TOURNAMENT ROUTE TREE, and it cannot any more.
 * `EURO-001`'s route half turned on 11 August 2026: the tournament's journeys
 * are registered — on one static table, as everything is — and refused on the
 * Hub by `servesEuroTournament` rather than by absence, because absence is not a
 * control when a guessable URL still resolves. `parkedEuroBoundary.test.ts` is
 * where that fact now lives, and it asserts every one of those addresses is
 * inside the boundary.
 *
 * What survives here is the one address that was never un-parked and must not
 * be: Euro as a season INSIDE the domestic competition tree. That tree is the
 * Hub's product. A tournament reachable through `/competitions/**` would put
 * Euro back on the weekly platform's own hierarchy through the front door.
 */
const RETIRED_TOURNAMENT = ['/competitions/euro/2028/original'] as const

const RETIRED_DOMESTIC = [
  '/competitions/:competitionSlug/:seasonSlug/main-predictor',
  '/competitions/:competitionSlug/:seasonSlug/last-man-standing',
  '/competitions/:competitionSlug/:seasonSlug/championship',
] as const

describe('weekly route declarations', () => {
  it('registers every canonical weekly route owned by the route authority', () => {
    for (const route of CANONICAL) expect(declaredRoutes).toContain(route)
  })

  it('never puts the tournament inside the domestic competition tree', () => {
    for (const route of RETIRED_TOURNAMENT) expect(declaredRoutes).not.toContain(route)
  })

  it('does not retain old domestic game addresses as a parallel hierarchy', () => {
    for (const route of RETIRED_DOMESTIC) expect(declaredRoutes).not.toContain(route)
  })

  it('keeps only explicit global compatibility redirects', () => {
    expect(redirectRoutes).toContain('/fixtures')
    // `/league` is NO LONGER one of them, and the reason is the collision
    // `variantRoutes.ts` records: it is a redirect on the Hub and the
    // tournament's own Leagues page on the Euro build, so its element is a
    // variant dispatcher rather than a `<Navigate>`. The redirect it performs on
    // this product is unchanged; where it is decided moved.
    expect(redirectRoutes).not.toContain('/league')
    expect(declaredRoutes).toContain('/league')
  })
})
