import { useEffect, useRef } from 'react'
import { matchPath, useLocation } from 'react-router'
import { weeklyRoutePatterns, weeklyRoutes } from './shellRoutes'
import { useSite } from './site/SiteProvider'

const SIGNED_OUT_ROOT_TITLE = 'Home'

const STATIC_ROUTE_TITLES: { path: string; title: string }[] = [
  // "Home", not "Competitions". The root used to be a competition chooser and
  // the title described it; it is now the personalised dashboard, its heading
  // says Home and the global destination that reaches it says Home. A tab
  // reading "Competitions" was the last place the retired shape survived, and
  // the catalogue it named lives at `/competitions` with a title of its own.
  { path: weeklyRoutes.hub, title: 'Home' },
  { path: '/auth/login', title: 'Log in' },
  { path: '/auth/signup', title: 'Sign up' },
  { path: '/auth/reset', title: 'Reset password' },
  { path: '/auth/update-password', title: 'Set new password' },
  { path: '/welcome', title: 'Welcome' },
  { path: '/join/:code', title: 'Join league' },
  { path: weeklyRoutes.play, title: 'Play' },
  { path: weeklyRoutes.matches, title: 'Matches' },
  { path: '/fixtures', title: 'Matches' },
  { path: weeklyRoutes.leagues, title: 'Leagues' },
  { path: weeklyRoutes.competitions, title: 'All competitions' },
  { path: '/league', title: 'Leagues' },
  { path: '/league/:id', title: 'League details' },
  { path: '/h2h/:rivalId', title: 'Head-to-head' },
  { path: '/more/scoring', title: 'Scoring rules' },
  { path: '/more/points', title: 'Profile' },
  { path: '/account', title: 'Account' },
  { path: weeklyRoutes.more, title: 'More' },
  { path: '/tournament/profile/:playerId', title: 'Player profile' },
  { path: '/tournament/profile', title: 'Tournament profile' },
  { path: '/profile', title: 'Profile' },
  { path: '/admin/results', title: 'Results Centre' },
  { path: '/admin/users', title: 'Users' },
  { path: '/admin/season', title: 'Competition administration' },
  { path: '/admin/ai', title: 'AI Lab' },
  { path: '/admin/euro', title: 'Euro 2028 publication' },
  { path: '/admin', title: 'Admin' },
]

/**
 * Titles for the `/dev/*` preview harnesses, which only exist in a development
 * build — `src/App.tsx` registers those routes behind the same condition.
 * Shipping their titles to production was shipping nine strings naming routes
 * that answer 404 there. `import.meta.env.DEV` is replaced at build time, so
 * the array below is dead code in a production bundle and is dropped.
 */
const DEV_ROUTE_TITLES: { path: string; title: string }[] = import.meta.env.DEV
  ? [
      { path: '/dev/components', title: 'Component gallery' },
      { path: '/dev/match-centre/:scenario', title: 'Match Centre preview' },
      { path: '/dev/season', title: 'Season preview' },
      { path: '/dev/season-leaderboard', title: 'Season leaderboard preview' },
      { path: '/dev/season-predictor', title: 'Season Match Predictor preview' },
      { path: '/dev/season-standings', title: 'Season standings preview' },
      { path: '/dev/season-lms', title: 'Season LMS preview' },
      { path: '/dev/season-cup', title: 'Season Championship preview' },
      { path: '/dev/ai-lab', title: 'AI Lab preview' },
      { path: '/dev/vnext-home', title: 'vNext Home real-data preview' },
      { path: '/dev/vnext-hub', title: 'vNext Football Hub host preview' },
    ]
  : []

const ROUTE_TITLES = [...STATIC_ROUTE_TITLES, ...DEV_ROUTE_TITLES]

const COMPETITION_TITLE_PATTERNS: readonly (readonly [pattern: string, suffix: string])[] = [
  [weeklyRoutePatterns.matchPredictorStandings, 'Match Predictor standings'],
  [weeklyRoutePatterns.matchPredictor, 'Match Predictor'],
  [weeklyRoutePatterns.championshipWildcard, 'Predictor Championship'],
  [weeklyRoutePatterns.lms, 'Last Man Standing'],
  [weeklyRoutePatterns.games, 'Games'],
  // Before the section it sits under, because `matchPath` with `end: true`
  // would otherwise never reach it — a fixture route is a longer path, not a
  // different one.
  [weeklyRoutePatterns.matchCentre, 'Match Centre'],
  // Before the competition overview pattern, for the same reason: a player
  // route is a longer path, not a different one.
  [weeklyRoutePatterns.player, 'Player'],
  [weeklyRoutePatterns.matches, 'Matches'],
  // INNOV-006. Named rather than left to the competition overview: a screen on
  // a wall is exactly the tab somebody hunts for among ten open ones.
  [weeklyRoutePatterns.tv, 'Matchday TV'],
  [weeklyRoutePatterns.leagues, 'Leagues'],
  [weeklyRoutePatterns.play, 'Play'],
  [weeklyRoutePatterns.competition, ''],
]

function competitionTitle(competitionSlug: string, seasonSlug: string, suffix: string): string {
  const competition = competitionSlug
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
  const season = seasonSlug.replace('-', '/')
  return [competition, season, suffix].filter(Boolean).join(' ')
}

export function getRouteTitle(
  pathname: string,
  options?: { readonly signedOut?: boolean },
): string {
  if (pathname === weeklyRoutes.hub && options?.signedOut) return SIGNED_OUT_ROOT_TITLE

  for (const [pattern, suffix] of COMPETITION_TITLE_PATTERNS) {
    const competitionMatch = matchPath({ path: pattern, end: true }, pathname)
    if (competitionMatch?.params.competitionSlug && competitionMatch.params.seasonSlug) {
      return competitionTitle(
        competitionMatch.params.competitionSlug,
        competitionMatch.params.seasonSlug,
        suffix,
      )
    }
  }

  const match = ROUTE_TITLES.find(({ path }) => matchPath({ path, end: true }, pathname))
  return match?.title ?? 'Page not found'
}

export function RouteAccessibility({ signedOut = false }: { signedOut?: boolean } = {}) {
  const { pathname } = useLocation()
  const isFirstRender = useRef(true)
  const routeTitle = getRouteTitle(pathname, { signedOut })
  // THE PRODUCT'S OWN NAME, NOT A CONSTANT. This was hard-coded to the weekly
  // platform's name, so every tab on the Euro deployment would have read
  // "Home | Football Prediction Hub" — the browser tab and every bookmark
  // naming the other product. The document head's `<title>` is generated per
  // deployment; this is the same fact at runtime and must come from the same
  // place. It still resolves to the weekly name on the Hub and when the variant
  // is unset, so nothing about that deployment's titles moves.
  const appName = useSite().brand.productName

  useEffect(() => {
    document.title = `${routeTitle} | ${appName}`

    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      document.getElementById('main-content')?.focus({ preventScroll: true })
    })

    return () => {
      cancelled = true
    }
  }, [appName, pathname, routeTitle])

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {routeTitle} page loaded
    </p>
  )
}
