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

const RETIRED_TOURNAMENT = [
  '/competitions/euro/2028/original',
  '/predict',
  '/predict/groups/:letter',
  '/predict/third-place',
  '/predict/bracket',
  '/predict/jokers',
  '/predict/review',
  '/league/overall',
  '/games',
  '/games/knockout',
  '/games/ko-predictor',
  '/games/lms',
  '/games/cup',
  '/match/:matchRef',
] as const

const RETIRED_DOMESTIC = [
  '/competitions/:competitionSlug/:seasonSlug/main-predictor',
  '/competitions/:competitionSlug/:seasonSlug/last-man-standing',
  '/competitions/:competitionSlug/:seasonSlug/championship',
] as const

describe('weekly route declarations', () => {
  it('registers every canonical weekly route owned by the route authority', () => {
    for (const route of CANONICAL) expect(declaredRoutes).toContain(route)
  })

  it('does not retain the tournament route tree in the weekly application', () => {
    for (const route of RETIRED_TOURNAMENT) expect(declaredRoutes).not.toContain(route)
  })

  it('does not retain old domestic game addresses as a parallel hierarchy', () => {
    for (const route of RETIRED_DOMESTIC) expect(declaredRoutes).not.toContain(route)
  })

  it('keeps only explicit global compatibility redirects', () => {
    expect(redirectRoutes).toContain('/fixtures')
    expect(redirectRoutes).toContain('/league')
  })
})
