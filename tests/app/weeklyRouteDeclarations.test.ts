import { describe, expect, it } from 'vitest'
import { declaredRoutes, redirectRoutes } from './declaredRoutes'

const CANONICAL = [
  '/',
  '/play',
  '/matches',
  '/leagues',
  '/more',
  '/competitions/:competitionSlug/:seasonSlug',
  '/competitions/:competitionSlug/:seasonSlug/play',
  '/competitions/:competitionSlug/:seasonSlug/matches',
  '/competitions/:competitionSlug/:seasonSlug/games',
  '/competitions/:competitionSlug/:seasonSlug/games/match-predictor',
  '/competitions/:competitionSlug/:seasonSlug/games/lms',
  '/competitions/:competitionSlug/:seasonSlug/games/championship/*',
  '/competitions/:competitionSlug/:seasonSlug/leagues',
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
  it('registers the complete canonical weekly hierarchy', () => {
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
