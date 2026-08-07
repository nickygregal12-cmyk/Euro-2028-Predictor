import { describe, expect, it } from 'vitest'
import {
  competitionGameRoute,
  competitionGameStandingsRoute,
  competitionRoute,
  competitionSectionRoute,
  logicalWeeklyParent,
  weeklyRoutes,
} from '../../src/app/weeklyRoutes'

const premier = { competitionSlug: 'premier-league', seasonSlug: '2026-27' }
const scottish = { competitionSlug: 'scottish-premiership', seasonSlug: '2026-27' }

describe('weekly route authority', () => {
  it('owns the five global Hub destinations', () => {
    expect(weeklyRoutes).toEqual({
      hub: '/',
      play: '/play',
      matches: '/matches',
      leagues: '/leagues',
      more: '/more',
    })
  })

  it('builds both domestic competition hierarchies', () => {
    for (const ref of [premier, scottish]) {
      const base = competitionRoute(ref)
      expect(base).toBe(`/competitions/${ref.competitionSlug}/2026-27`)
      expect(competitionSectionRoute(ref, 'play')).toBe(`${base}/play`)
      expect(competitionSectionRoute(ref, 'matches')).toBe(`${base}/matches`)
      expect(competitionSectionRoute(ref, 'games')).toBe(`${base}/games`)
      expect(competitionSectionRoute(ref, 'leagues')).toBe(`${base}/leagues`)
      expect(competitionGameRoute(ref, 'match-predictor')).toBe(`${base}/games/match-predictor`)
      expect(competitionGameRoute(ref, 'lms')).toBe(`${base}/games/lms`)
      expect(competitionGameRoute(ref, 'championship')).toBe(`${base}/games/championship`)
      expect(competitionGameStandingsRoute(ref)).toBe(`${base}/games/match-predictor/standings`)
    }
  })

  it('refuses malformed route identities rather than silently constructing them', () => {
    expect(() => competitionRoute({ competitionSlug: '', seasonSlug: '2026-27' })).toThrow()
    expect(() => competitionRoute({ competitionSlug: 'premier-league/x', seasonSlug: '2026-27' })).toThrow()
    expect(() =>
      competitionGameRoute(premier, 'unsupported' as never),
    ).toThrow(/Unsupported weekly route value/)
  })

  it('derives deterministic parents without browser history', () => {
    expect(logicalWeeklyParent('/competitions/premier-league/2026-27')).toEqual({
      href: '/',
      label: 'Back to Hub',
    })
    expect(
      logicalWeeklyParent('/competitions/premier-league/2026-27/games/lms'),
    ).toEqual({
      href: '/competitions/premier-league/2026-27/games',
      label: 'Back to Games',
    })
    expect(logicalWeeklyParent('/league/abc123')).toEqual({
      href: '/leagues',
      label: 'Back to Leagues',
    })
  })
})
