import { Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { AuthSplash } from '../features/auth/AuthSplash'
import { getPendingJoin } from '../features/leagues/pendingJoin'
import { TournamentDataProvider } from './providers/TournamentDataProvider'
import { PredictionsProvider } from './providers/PredictionsProvider'

// Session-aware app composition. AuthProvider sits at the top so both the auth
// screens and the app share one session; two gates then split the tree:
//   • RequireAuth  — mounts the tournament data + predictions providers and the
//     app shell only once signed in; otherwise redirects to the log-in screen.
//   • RedirectIfAuthed — keeps the auth screens for signed-out users only.
// While the session is still resolving, both gates show a neutral splash so a
// refresh never flashes the logged-out screens (docs/auth-plan.md §3).

export function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export function RequireAuth() {
  const { userId, loading } = useAuth()
  if (loading) return <AuthSplash />
  if (!userId) return <Navigate to="/auth/login" replace />
  return (
    <TournamentDataProvider>
      <PredictionsProvider>
        <Outlet />
      </PredictionsProvider>
    </TournamentDataProvider>
  )
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
