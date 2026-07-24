import { useEffect, useRef } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import styles from './RouteAccessibility.module.css'

const APP_NAME = 'Euro 2028 Predictor'

const STATIC_ROUTE_TITLES: { path: string; title: string }[] = [
  { path: '/', title: 'Home' },
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
  { path: '/league/overall', title: 'Overall standings' },
  { path: '/league/:id', title: 'League details' },
  { path: '/league', title: 'Leagues' },
  { path: '/h2h/:rivalId', title: 'Head-to-head' },
  { path: '/matches', title: 'Matches' },
  { path: '/match/:matchRef', title: 'Match centre' },
  { path: '/more/scoring', title: 'Scoring rules' },
  { path: '/more/points', title: 'Profile' },
  { path: '/more', title: 'More' },
  { path: '/profile', title: 'Profile' },
  { path: '/dev/components', title: 'Component gallery' },
]

export function getRouteTitle(pathname: string): string {
  const groupMatch = matchPath('/predict/groups/:letter', pathname)
  if (groupMatch?.params.letter) {
    return `Group ${groupMatch.params.letter.toUpperCase()} predictions`
  }

  const match = STATIC_ROUTE_TITLES.find(({ path }) => matchPath({ path, end: true }, pathname))
  return match?.title ?? 'Page not found'
}

/**
 * Gives client-side route changes browser-title, live-region and focus behavior
 * comparable to a full page load. The first render sets the title/announcement
 * but does not steal focus from the browser or an auth form.
 */
export function RouteAccessibility() {
  const { pathname } = useLocation()
  const isFirstRender = useRef(true)
  const routeTitle = getRouteTitle(pathname)

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
    <p className={styles.liveRegion} aria-live="polite" aria-atomic="true">
      {routeTitle} page loaded
    </p>
  )
}
