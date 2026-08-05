import { useEffect, useRef } from 'react'
import { matchPath, useLocation } from 'react-router'

const APP_NAME = 'Football Prediction Hub'

/**
 * The one route whose page depends on the session rather than the path.
 *
 * `/` serves the Hub to a signed-in player and the public landing page to
 * everyone else (modernisation plan Appendix E.1). Titling it from the path
 * alone would tell a first-time visitor's screen reader that the "Competitions"
 * page had loaded, on a page that shows them no competitions and asks them to
 * create an account — so the root has two titles and the session picks.
 */
const SIGNED_OUT_ROOT_TITLE = 'Home'

/**
 * Every route the application declares, ordered so the first `matchPath` hit is
 * the most specific — `/league/overall` before `/league`, `/games/lms` before
 * `/games`.
 *
 * `getRouteTitle` falls back to 'Page not found', so a route missing from here
 * does not fail: it sets the browser title and announces a page that does not
 * exist. `tests/app/routeTitleCoverage.test.ts` compares this list against the
 * routes in `App.tsx`, so the fallback catches typos rather than omissions.
 */
const STATIC_ROUTE_TITLES: { path: string; title: string }[] = [
  { path: '/', title: 'Competitions' },
  { path: '/competitions/euro/2028/original', title: 'Euro 2028 Original Predictor' },
  { path: '/competitions/:competitionSlug/:seasonSlug', title: 'Competition dashboard' },
  { path: '/auth/login', title: 'Log in' },
  { path: '/auth/signup', title: 'Sign up' },
  { path: '/auth/reset', title: 'Reset password' },
  { path: '/auth/update-password', title: 'Set new password' },
  { path: '/welcome', title: 'Welcome' },
  { path: '/join/:code', title: 'Join league' },
  { path: '/predict', title: 'Predict' },
  { path: '/predict/third-place', title: 'Third-place predictions' },
  { path: '/predict/bracket', title: 'Knockout bracket' },
  { path: '/predict/jokers', title: 'Jokers' },
  { path: '/predict/review', title: 'Review predictions' },
  { path: '/prediction-trends', title: 'Prediction trends' },
  { path: '/league/overall', title: 'Overall standings' },
  { path: '/league/:id', title: 'League details' },
  { path: '/league', title: 'Leagues' },
  { path: '/h2h/:rivalId', title: 'Head-to-head' },
  { path: '/games/knockout', title: 'Knockout predictions' },
  { path: '/games/ko-predictor', title: 'KO Predictor' },
  { path: '/games/lms', title: 'Last Man Standing' },
  { path: '/games/cup', title: 'Predictor Cup' },
  { path: '/games', title: 'Bonus Games' },
  { path: '/matches', title: 'Matches' },
  { path: '/match/:matchRef', title: 'Match centre' },
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
]

export function getRouteTitle(
  pathname: string,
  options?: { readonly signedOut?: boolean },
): string {
  if (pathname === '/' && options?.signedOut) return SIGNED_OUT_ROOT_TITLE

  const groupMatch = matchPath('/predict/groups/:letter', pathname)
  if (groupMatch?.params.letter) {
    return `Group ${groupMatch.params.letter.toUpperCase()} predictions`
  }

  const competitionMatch = matchPath(
    '/competitions/:competitionSlug/:seasonSlug',
    pathname,
  )
  if (competitionMatch?.params.competitionSlug && competitionMatch.params.seasonSlug) {
    const competition = competitionMatch.params.competitionSlug
      .split('-')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
    return `${competition} ${competitionMatch.params.seasonSlug.replace('-', '/')}`
  }

  const match = STATIC_ROUTE_TITLES.find(({ path }) => matchPath({ path, end: true }, pathname))
  return match?.title ?? 'Page not found'
}

/**
 * Gives client-side route changes browser-title, live-region and focus behavior
 * comparable to a full page load. The first render sets the title/announcement
 * but does not steal focus from the browser or an auth form.
 *
 * `signedOut` is a prop rather than a `useAuth()` call, and deliberately so:
 * reading the session here would make this module — and `getRouteTitle` with it
 * — import the Supabase client transitively, so a route-title test could not
 * run without Supabase configuration. The caller inside the provider passes the
 * fact down; the callers outside it pass nothing and get the path-only titles
 * they had before.
 */
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
