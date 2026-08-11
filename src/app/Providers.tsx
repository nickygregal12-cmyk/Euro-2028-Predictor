import { lazy, Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { AuthSplash } from '../features/auth/AuthSplash'
import { getPendingJoin } from '../features/leagues/pendingJoin'
import { RouteAccessibility } from './RouteAccessibility'
import { RouteFallback } from './RouteFallback'
import { isNextUi } from './routeFlags'
import { useSite } from './site/SiteProvider'

// Lazy, so the marketing page is never in a signed-in player's bundle. It is
// the one route a returning player never sees.
//
// TWO PAGES, ONE URL, AND ONLY ONE OF THEM IS EVER FETCHED. The two deployments
// have genuinely different front doors — three equal weekly games across two
// domestic competitions, or one tournament with the weekly games beneath it —
// and the variant is fixed at build time, so a Hub visitor never downloads the
// tournament page and a Euro visitor never downloads the weekly one.
const LandingPage = lazy(() =>
  import('../features/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const EuroLandingPage = lazy(() =>
  import('../features/landing/EuroLandingPage').then((m) => ({ default: m.EuroLandingPage })),
)

// Session-aware app composition. AuthProvider sits at the top so both the auth
// screens and the app share one session; two gates then split the tree:
//   • RequireAuth  — admits a signed-in user to the app shell; otherwise
//     redirects to the log-in screen. It no longer mounts the tournament data
//     and predictions providers: those belong to the routes that consume them,
//     and now sit under `TournamentJourney` (see that file for why).
//   • RedirectIfAuthed — keeps the auth screens for signed-out users only.
// While the session is still resolving, both gates show a neutral splash so a
// refresh never flashes the logged-out screens (docs/auth-plan.md §3).

export function AuthLayout() {
  return (
    <AuthProvider>
      {/* Inside the provider, so the route announcement can tell the two pages
          that share `/` apart: signed out it is the public landing page, signed
          in it is the Hub. See RouteAccessibility for why that matters. */}
      <SessionAwareRouteAccessibility />
      <Outlet />
    </AuthProvider>
  )
}

/**
 * Reads the session so `RouteAccessibility` does not have to.
 *
 * A separate component because `AuthLayout` renders the provider and cannot
 * consume its own context; three lines here keep the title layer free of any
 * dependency on the auth service. `loading` is not signed out — treating it as
 * such would announce the landing page's title for a moment on every
 * authenticated refresh, before the session resolves and the Hub appears.
 */
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

/**
 * What a signed-out visitor gets when they ask for a signed-in route.
 *
 * Everywhere except the root, the answer is unchanged and unchanging: the log
 * in screen, which is where someone asking for their own predictions needs to
 * go, and which returns them afterwards.
 *
 * The root is the exception Appendix E.1 creates. `/` signed out is not a
 * locked door to the Hub, it is the public conversion page — a different page
 * that happens to share the URL, in the way most products' front doors do. So
 * the branch is on the path rather than on some property of the session.
 *
 * Rendering the landing page here, rather than declaring it as its own
 * `<Route>`, is deliberate. React Router resolves one element per path, and `/`
 * is already claimed by the Hub inside three nested gates — the auth gate, the
 * welcome gate and the app shell. Giving the
 * landing page its own path would have moved the signed-in Hub off `/` — a URL
 * change for every existing player, and every bookmark and shared link they
 * hold, to avoid a five-line branch.
 *
 * FAIL CLOSED, like every other route flag: unset means `/auth/login`, which is
 * exactly what happened before this page existed.
 */
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
    // Resume a pending invite join if the visitor arrived via a deep link while
    // signed out (JoinLandingPage clears it once handled); otherwise Home.
    const pending = getPendingJoin()
    return <Navigate to={pending ? `/join/${pending}` : '/'} replace />
  }
  return <Outlet />
}

// Sits above the app shell (but not the /welcome route itself): a never-welcomed
// user is routed to /welcome once, before Home. While the profile resolves it
// shows the neutral splash so the app never flashes before the redirect
// (docs/design-system.md §6). The gate is purely welcomed_at-driven — the dev
// user is pre-stamped in supabase/dev-user.sql, so it's never special-cased here.
export function RequireWelcome() {
  const { welcomeStatus } = useAuth()
  if (welcomeStatus === 'loading') return <AuthSplash />
  if (welcomeStatus === 'needed') return <Navigate to="/welcome" replace />
  return <Outlet />
}
