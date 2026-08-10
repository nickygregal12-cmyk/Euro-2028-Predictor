import { describe, expect, it } from 'vitest'
import {
  competitionChampionshipFixturesRoute,
  competitionChampionshipInstanceRoute,
  competitionChampionshipTableRoute,
  competitionGameRoute,
  competitionGameStandingsRoute,
  competitionRoute,
  competitionSectionRoute,
  logicalWeeklyParent,
  weeklyRoutes,
  competitionMatchPredictorRoute,
} from '../../src/app/weeklyRoutes'

const premier = { competitionSlug: 'premier-league', seasonSlug: '2026-27' }
const scottish = { competitionSlug: 'scottish-premiership', seasonSlug: '2026-27' }
const CHAMPIONSHIP_ID = '60000000-0000-0000-0000-000000000103'

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
      const championship = `${base}/games/championship`
      expect(base).toBe(`/competitions/${ref.competitionSlug}/2026-27`)
      expect(competitionSectionRoute(ref, 'play')).toBe(`${base}/play`)
      expect(competitionSectionRoute(ref, 'matches')).toBe(`${base}/matches`)
      expect(competitionSectionRoute(ref, 'games')).toBe(`${base}/games`)
      expect(competitionSectionRoute(ref, 'leagues')).toBe(`${base}/leagues`)
      expect(competitionGameRoute(ref, 'match-predictor')).toBe(`${base}/games/match-predictor`)
      expect(competitionGameRoute(ref, 'lms')).toBe(`${base}/games/lms`)
      expect(competitionGameRoute(ref, 'championship')).toBe(championship)
      expect(competitionGameStandingsRoute(ref)).toBe(`${base}/games/match-predictor/standings`)
      expect(competitionChampionshipInstanceRoute(ref, CHAMPIONSHIP_ID)).toBe(
        `${championship}/${CHAMPIONSHIP_ID}`,
      )
      expect(competitionChampionshipTableRoute(ref, CHAMPIONSHIP_ID)).toBe(
        `${championship}/${CHAMPIONSHIP_ID}/table`,
      )
      expect(competitionChampionshipFixturesRoute(ref, CHAMPIONSHIP_ID)).toBe(
        `${championship}/${CHAMPIONSHIP_ID}/fixtures`,
      )
    }
  })

  it('refuses malformed route identities rather than silently constructing them', () => {
    expect(() => competitionRoute({ competitionSlug: '', seasonSlug: '2026-27' })).toThrow()
    expect(() => competitionRoute({ competitionSlug: 'premier-league/x', seasonSlug: '2026-27' })).toThrow()
    expect(() => competitionChampionshipInstanceRoute(premier, 'bad/id')).toThrow()
    expect(() =>
      competitionGameRoute(premier, 'unsupported' as never),
    ).toThrow(/Unsupported weekly route value/)
  })

  it('derives the canonical parent for every current weekly route class', () => {
    const base = competitionRoute(premier)
    const games = competitionSectionRoute(premier, 'games')
    const matches = competitionSectionRoute(premier, 'matches')
    const leagues = competitionSectionRoute(premier, 'leagues')
    const matchPredictor = competitionGameRoute(premier, 'match-predictor')
    const championships = competitionGameRoute(premier, 'championship')
    const championship = competitionChampionshipInstanceRoute(premier, CHAMPIONSHIP_ID)

    const cases = [
      [weeklyRoutes.play, { href: '/', label: 'Back to Hub' }],
      [weeklyRoutes.matches, { href: '/', label: 'Back to Hub' }],
      [weeklyRoutes.leagues, { href: '/', label: 'Back to Hub' }],
      [weeklyRoutes.more, { href: '/', label: 'Back to Hub' }],
      ['/account', { href: '/more', label: 'Back to More' }],
      ['/profile', { href: '/more', label: 'Back to More' }],
      ['/more/scoring', { href: '/more', label: 'Back to More' }],
      ['/profile/player-1', { href: '/leagues', label: 'Back to Leagues' }],
      ['/h2h/player-1', { href: '/leagues', label: 'Back to Leagues' }],
      ['/league/private-1', { href: '/leagues', label: 'Back to Leagues' }],
      ['/match/fixture-1', { href: '/matches', label: 'Back to Matches' }],
      [base, { href: '/', label: 'Back to Hub' }],
      [`${base}/play`, { href: '/', label: 'Back to Hub' }],
      [`${base}/matches`, { href: '/', label: 'Back to Hub' }],
      [`${base}/games`, { href: '/', label: 'Back to Hub' }],
      [`${base}/leagues`, { href: '/', label: 'Back to Hub' }],
      [matchPredictor, { href: games, label: 'Back to Games' }],
      [`${games}/lms`, { href: games, label: 'Back to Games' }],
      [championships, { href: games, label: 'Back to Games' }],
      [championship, { href: championships, label: 'Back to Championships' }],
      [
        competitionChampionshipTableRoute(premier, CHAMPIONSHIP_ID),
        { href: championship, label: 'Back to Championship' },
      ],
      [
        competitionChampionshipFixturesRoute(premier, CHAMPIONSHIP_ID),
        { href: championship, label: 'Back to Championship' },
      ],
      [competitionGameStandingsRoute(premier), { href: matchPredictor, label: 'Back to Match Predictor' }],
      [`${matches}/fixture-1`, { href: matches, label: 'Back to Matches' }],
      [`${leagues}/container-1`, { href: leagues, label: 'Back to Leagues' }],
      [`${base}/players/player-1`, { href: base, label: 'Back to Competition' }],
    ] as const

    for (const [pathname, expected] of cases) {
      expect(logicalWeeklyParent(pathname), pathname).toEqual(expected)
    }
  })

  it('does not invent parents for sessionless or unknown top-level routes', () => {
    expect(logicalWeeklyParent('/')).toBeNull()
    expect(logicalWeeklyParent('/auth/login')).toBeNull()
    expect(logicalWeeklyParent('/admin/results')).toBeNull()
    expect(logicalWeeklyParent('/somewhere-unknown')).toBeNull()
  })
})

describe('opening the Match Predictor at a named matchweek', () => {
  const ref = { competitionSlug: 'scottish-premiership', seasonSlug: '2026-27' }

  it('adds the matchweek as a query, leaving the route itself unchanged', () => {
    // An opening position, not an identity: every link that omits it must be
    // the same route, or a shared link becomes a different page.
    expect(competitionMatchPredictorRoute(ref)).toBe(
      competitionGameRoute(ref, 'match-predictor'),
    )
    expect(competitionMatchPredictorRoute(ref, 7)).toBe(
      `${competitionGameRoute(ref, 'match-predictor')}?matchweek=7`,
    )
  })

  it('refuses a matchweek that could never be one', () => {
    // Building the link is where a nonsense value should fail — loudly, in the
    // caller — rather than travelling into a URL somebody later shares.
    expect(() => competitionMatchPredictorRoute(ref, 0)).toThrow()
    expect(() => competitionMatchPredictorRoute(ref, -1)).toThrow()
    expect(() => competitionMatchPredictorRoute(ref, 1.5)).toThrow()
  })
})
