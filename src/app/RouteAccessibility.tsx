import { useEffect, useRef } from 'react'
import { matchPath, useLocation } from 'react-router'

const APP_NAME = 'Football Prediction Hub'
const SIGNED_OUT_ROOT_TITLE = 'Home'

const STATIC_ROUTE_TITLES: { path: string; title: string }[] = [
  { path: '/', title: 'Competitions' },
  { path: '/auth/login', title: 'Log in' },
  { path: '/auth/signup', title: 'Sign up' },
  { path: '/auth/reset', title: 'Reset password' },
  { path: '/auth/update-password', title: 'Set new password' },
  { path: '/welcome', title: 'Welcome' },
  { path: '/join/:code', title: 'Join league' },
  { path: '/play', title: 'Play' },
  { path: '/matches', title: 'Matches' },
  { path: '/fixtures', title: 'Matches' },
  { path: '/leagues', title: 'Leagues' },
  { path: '/league', title: 'Leagues' },
  { path: '/league/:id', title: 'League details' },
  { path: '/h2h/:rivalId', title: 'Head-to-head' },
  { path: '/more/scoring', title: 'Scoring rules' },
  { path: '/more/points', title: 'Profile' },
  { path: '/account', title: 'Account' },
  { path: '/more', title: 'More' },
  { path: '/profile/:playerId', title: 'Player profile' },
  { path: '/profile', title: 'Profile' },
  { path: '/admin/results', title: 'Results Centre' },
  { path: '/admin/users', title: 'Users' },
  { path: '/admin', title: 'Admin' },
  { path: '/dev/components', title: 'Component gallery' },
  { path: '/dev/match-centre/:scenario', title: 'Match Centre preview' },
  { path: '/dev/season', title: 'Season preview' },
  { path: '/dev/season-leaderboard', title: 'Season leaderboard preview' },
  { path: '/dev/season-predictor', title: 'Season Match Predictor preview' },
  { path: '/dev/season-standings', title: 'Season standings preview' },
  { path: '/dev/season-lms', title: 'Season LMS preview' },
  { path: '/dev/season-cup', title: 'Season Championship preview' },
]

const COMPETITION_TITLE_PATTERNS: readonly (readonly [pattern: string, suffix: string])[] = [
  [
    '/competitions/:competitionSlug/:seasonSlug/games/match-predictor/standings',
    'Match Predictor standings',
  ],
  ['/competitions/:competitionSlug/:seasonSlug/games/match-predictor', 'Match Predictor'],
  ['/competitions/:competitionSlug/:seasonSlug/games/championship', 'Predictor Championship'],
  ['/competitions/:competitionSlug/:seasonSlug/games/lms', 'Last Man Standing'],
  ['/competitions/:competitionSlug/:seasonSlug/games', 'Games'],
  ['/competitions/:competitionSlug/:seasonSlug/matches', 'Matches'],
  ['/competitions/:competitionSlug/:seasonSlug/leagues', 'Leagues'],
  ['/competitions/:competitionSlug/:seasonSlug/play', 'Play'],
  ['/competitions/:competitionSlug/:seasonSlug', ''],
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
  if (pathname === '/' && options?.signedOut) return SIGNED_OUT_ROOT_TITLE

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

  const match = STATIC_ROUTE_TITLES.find(({ path }) => matchPath({ path, end: true }, pathname))
  return match?.title ?? 'Page not found'
}

export function RouteAccessibility({ signedOut = false }: { signedOut?: boolean } = {}) {
  const { pathname } = useLocation()
  const isFirstRender = useRef(true)
  const routeTitle = getRouteTitle(pathname, { signedOut })

  useEffect(() => {
    document.title = `${routeTitle} | ${APP_NAME}`

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
  }, [pathname, routeTitle])

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {routeTitle} page loaded
    </p>
  )
}
