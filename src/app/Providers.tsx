import { lazy, Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { AuthSplash } from '../features/auth/AuthSplash'
import { needsPublicFootballName } from '../features/auth/publicFootballName'
import { getPendingJoin } from '../features/leagues/pendingJoin'
import { RouteAccessibility } from './RouteAccessibility'
import { RouteFallback } from './RouteFallback'
import { isNextUi } from './routeFlags'
import { useSite } from './site/SiteProvider'

const LandingPage = lazy(() =>
  import('../features/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const EuroLandingPage = lazy(() =>
  import('../features/landing/EuroLandingPage').then((m) => ({ default: m.EuroLandingPage })),
)

export function AuthLayout() {
  return (
    <AuthProvider>
      <SessionAwareRouteAccessibility />
      <Outlet />
    </AuthProvider>
  )
}

function SessionAwareRouteAccessibility() {
  const { userId, loading } = useAuth()
  return <RouteAccessibility signedOut={!loading && userId === null} />
}

export function RequireAuth() {
  const { userId, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <AuthSplash />
  if (!userId) return <SignedOutDestination pathname={pathname} />
  return <Outlet />
}

function SignedOutDestination({ pathname }: { pathname: string }) {
  const site = useSite()
  if (pathname === '/' && isNextUi('publicLanding')) {
    return (
      <Suspense fallback={<RouteFallback />}>
        {site.variant === 'euro' ? <EuroLandingPage /> : <LandingPage />}
      </Suspense>
    )
  }
  return <Navigate to="/auth/login" replace />
}

export function RedirectIfAuthed() {
  const { userId, loading } = useAuth()
  if (loading) return <AuthSplash />
  if (userId) {
    const pending = getPendingJoin()
    return <Navigate to={pending ? `/join/${pending}` : '/'} replace />
  }
  return <Outlet />
}

/**
 * First-entry gate. `welcomed_at` still owns ordinary onboarding, while the
 * public-name check closes the OAuth identity seam: a neutral server fallback
 * may never become the name shown on leaderboards merely because `/welcome`
 * was stamped during an interrupted first visit.
 */
export function RequireWelcome() {
  const { welcomeStatus, displayName } = useAuth()
  if (welcomeStatus === 'loading') return <AuthSplash />
  if (welcomeStatus === 'needed' || needsPublicFootballName(displayName)) {
    return <Navigate to="/welcome" replace />
  }
  return <Outlet />
}