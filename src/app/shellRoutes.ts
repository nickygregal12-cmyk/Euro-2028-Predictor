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

/**
 * The five global destinations, as the bottom bar names them. Declared here
 * rather than in the design system because which tab a route belongs to is a
 * routing fact; `BottomNav` re-exports this as `NavKey` so there is one list
 * rather than two that can disagree.
 */
export type GlobalNavTab = 'home' | 'predict' | 'matches' | 'league' | 'more'

/**
 * Which global tab a pathname belongs to.
 *
 * A COMPETITION ROUTE STILL HAS ONE, and that is why this exists. The bar used
 * to be hidden entirely inside `/competitions/**`, so the question never arose;
 * the design authority says the global navigation "remains visible inside
 * competition context" and "never swaps its destinations", so every competition
 * page now has to say which of the five it sits under.
 *
 * The mapping is the chooser's, read backwards. Tapping Matches leads to a
 * competition's `matches` section (`competitionChooserModel`), so a
 * competition's `matches` section highlights Matches; the same for Play and
 * Leagues. Overview and Games were reached from the Hub itself and highlight
 * Home, while a game route under `games/` is where playing happens and
 * highlights Play rather than the Home tab that led to it.
 *
 * MATCHING IS BY PREFIX, not by equality. The old exact comparisons meant no
 * deep route anywhere lit a tab — a player at a league table saw five
 * unselected tabs and no indication of where they were.
 */
export function globalNavTab(pathname: string): GlobalNavTab {
  if (isCompetitionModePath(pathname)) {
    const section = pathname.replace(/^\/competitions\/[^/]+\/[^/]+/, '')
    if (section.startsWith('/matches')) return 'matches'
    if (section.startsWith('/leagues')) return 'league'
    if (section.startsWith('/play') || section.startsWith('/games/')) return 'predict'
    return 'home'
  }

  if (pathname === weeklyRoutes.play) return 'predict'
  if (pathname === weeklyRoutes.matches || pathname.startsWith('/match/')) return 'matches'
  if (
    pathname === weeklyRoutes.leagues ||
    pathname.startsWith('/league/') ||
    pathname.startsWith('/h2h/')
  ) {
    return 'league'
  }
  if (
    pathname === weeklyRoutes.more ||
    pathname.startsWith('/more/') ||
    pathname === '/account' ||
    pathname.startsWith('/profile')
  ) {
    return 'more'
  }
  return 'home'
}
