export const weeklyRoutes = {
  hub: '/',
  play: '/play',
  matches: '/matches',
  leagues: '/leagues',
  more: '/more',
} as const

/**
 * Canonical registered route patterns for the domestic weekly competition tree.
 * App.tsx consumes these values directly, and the URL builders in weeklyRoutes.ts
 * render from the same authority so registration and navigation cannot drift.
 */
export const weeklyRoutePatterns = {
  competition: '/competitions/:competitionSlug/:seasonSlug',
  play: '/competitions/:competitionSlug/:seasonSlug/play',
  matches: '/competitions/:competitionSlug/:seasonSlug/matches',
  games: '/competitions/:competitionSlug/:seasonSlug/games',
  matchPredictor: '/competitions/:competitionSlug/:seasonSlug/games/match-predictor',
  matchPredictorStandings:
    '/competitions/:competitionSlug/:seasonSlug/games/match-predictor/standings',
  lms: '/competitions/:competitionSlug/:seasonSlug/games/lms',
  championship: '/competitions/:competitionSlug/:seasonSlug/games/championship',
  championshipWildcard: '/competitions/:competitionSlug/:seasonSlug/games/championship/*',
  leagues: '/competitions/:competitionSlug/:seasonSlug/leagues',
} as const

/**
 * The signed-in shell needs only to know whether a route belongs to a concrete
 * competition season. Keep that tiny predicate with the global/pattern route
 * authority so the full deep-route helper implementation remains lazy.
 */
export function isCompetitionModePath(pathname: string): boolean {
  return /^\/competitions\/[^/]+\/[^/]+(?:\/|$)/.test(pathname)
}
