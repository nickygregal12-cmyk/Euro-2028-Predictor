import { describe, expect, it } from 'vitest'
import { logicalWeeklyParent } from '../../src/app/weeklyRoutes'
import { appSource, routePaths } from './declaredRoutes'

const SHELL_START = appSource.indexOf('<Route element={<AppShell />}>')
const ADMIN_START = appSource.indexOf('<Route element={<RequireAdmin />}>', SHELL_START)

const REDIRECT_ONLY = new Set(['/fixtures', '/league', '/more/points'])

const SHIPPED_WEEKLY_ROUTES = [
  '/competitions',
  '/competitions/:competitionSlug/:seasonSlug/matches/:fixtureId',
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
  '/competitions/:competitionSlug/:seasonSlug/games/match-predictor/standings',
  '/competitions/:competitionSlug/:seasonSlug/games/lms',
  '/competitions/:competitionSlug/:seasonSlug/games/championship/*',
  '/competitions/:competitionSlug/:seasonSlug/leagues',
  '/competitions/:competitionSlug/:seasonSlug/tv',
  '/competitions/:competitionSlug/:seasonSlug/players/:playerId',
  '/league/:id',
  '/league/overall',
  '/h2h/:rivalId',
  // The tournament's own journeys live inside the signed-in shell but are
  // deployment-gated by TournamentJourney. They still need a deterministic
  // logical parent on the Euro deployment even though the Hub refuses them.
  '/predict',
  '/predict/groups/:letter',
  '/predict/third-place',
  '/predict/bracket',
  '/predict/jokers',
  '/predict/review',
  '/prediction-trends',
  '/match/:matchRef',
  '/games',
  '/games/knockout',
  '/games/ko-predictor',
  '/games/lms',
  '/games/cup',
  '/account',
  '/profile',
  '/tournament/profile',
  '/tournament/profile/:playerId',
  '/more/scoring',
] as const

function materialise(template: string): string {
  return template
    .replace(':competitionSlug', 'premier-league')
    .replace(':seasonSlug', '2026-27')
    .replace(':id', 'private-1')
    .replace(':rivalId', 'player-2')
    .replace(':playerId', 'player-2')
    .replace(':fixtureId', 'fixture-1')
    .replace(':letter', 'A')
    .replace(':matchRef', 'R16-1')
    .replace('*', 'private-1')
}

describe('weekly route parent coverage', () => {
  it('enumerates every rendered non-admin route inside the authenticated App shell', () => {
    expect(SHELL_START).toBeGreaterThanOrEqual(0)
    expect(ADMIN_START).toBeGreaterThan(SHELL_START)

    const shellSource = appSource.slice(SHELL_START, ADMIN_START)
    const declared = routePaths(shellSource)
      .filter((path) => !REDIRECT_ONLY.has(path))
      .sort()

    expect(declared).toEqual([...SHIPPED_WEEKLY_ROUTES].sort())
  })

  it('gives every shipped non-root weekly route a deterministic parent', () => {
    for (const template of SHIPPED_WEEKLY_ROUTES) {
      if (template === '/') continue
      const pathname = materialise(template)
      expect(logicalWeeklyParent(pathname), `${template} -> ${pathname}`).not.toBeNull()
    }
  })
})
