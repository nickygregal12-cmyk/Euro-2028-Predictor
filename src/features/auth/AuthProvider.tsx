import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  getCurrentSession,
  onAuthChange,
  signOut as serviceSignOut,
} from '../../services/supabase/auth'
import { fetchMyProfile, fetchWelcomedAt, markWelcomedNow } from '../../services/supabase/profile'
import { removeCurrentPushSubscription } from '../../services/pushNotifications'
import { welcomeStatusFor, type WelcomeStatus } from '../welcome/welcomeGating'

// Session state for the whole app. The session is established either by real
// auth screens (log in / sign up) or, in a dev build, by the auto-login shim on
// startup (docs/auth-plan.md §1). This provider treats every session the same
// way — nothing here special-cases the dev user (CLAUDE.md rule 8).

type AuthContextValue = {
  userId: string | null
  displayName: string | null
  loading: boolean
  // /welcome gate: 'loading' while the profile resolves, 'needed' for a
  // never-welcomed user, 'seen' otherwise. `markWelcomed` stamps it seen.
  welcomeStatus: WelcomeStatus
  markWelcomed: () => void
  signOut: () => Promise<void>
  // Re-reads the profile (display name) after an Account-page change.
  refreshProfile: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [profileNonce, setProfileNonce] = useState(0)
  const [loading, setLoading] = useState(true)
  const [welcomeStatus, setWelcomeStatus] = useState<WelcomeStatus>('loading')

  useEffect(() => {
    let active = true
    getCurrentSession().then((session) => {
      if (!active) return
      setUserId(session?.user.id ?? null)
      setLoading(false)
    })
    const unsubscribe = onAuthChange((session) => setUserId(session?.user.id ?? null))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setDisplayName(null)
      setWelcomeStatus('loading')
      return
    }
    let active = true
    setWelcomeStatus('loading')
    // Fetch the display name and the welcome-seen state together, so the gate
    // knows whether to route to /welcome before rendering the app.
    Promise.all([fetchMyProfile(userId), fetchWelcomedAt(userId)])
      .then(([profile, welcome]) => {
        if (!active) return
        setDisplayName(profile?.displayName ?? null)
        setWelcomeStatus(welcomeStatusFor(welcome))
      })
      .catch(() => {
        if (!active) return
        setDisplayName(null)
        // Fail open: don't trap anyone on the welcome gate if the read fails.
        setWelcomeStatus('seen')
      })
    return () => {
      active = false
    }
  }, [userId, profileNonce])

  function refreshProfile() {
    setProfileNonce((nonce) => nonce + 1)
  }

  function markWelcomed() {
    // Optimistic: advance the gate immediately so navigation off /welcome is
    // instant; persist best-effort (idempotent — keeps the first-seen time).
    setWelcomeStatus('seen')
    if (userId) void markWelcomedNow(userId)
  }

  async function signOut() {
    // A real sign-out: clear the session and let the route gate show the auth
    // screens. The dev auto-login shim only runs at startup (main.tsx), so
    // signing out no longer bounces straight back in — a full reload in a dev
    // build with the flag on will auto-login again, which is expected.
    if (userId) await removeCurrentPushSubscription()
    await serviceSignOut()
  }

  return (
    <AuthContext.Provider
      value={{ userId, displayName, loading, welcomeStatus, markWelcomed, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

/**
 * The session where there is one, and null where the tree has no provider.
 *
 * WHEN TO REACH FOR THIS RATHER THAN `useAuth`. Only for a PROGRESSIVE
 * ENHANCEMENT — something that is simply absent without an account, and whose
 * absence changes nothing else on the surface. `INNOV-020`'s offline drafting
 * is the case it was added for: a draft has to be scoped to an account or it
 * must not exist at all, and a shell rendered without the provider should lose
 * the drafting rather than throw.
 *
 * ANYTHING THAT GATES ACCESS STILL USES `useAuth`. A permission check that
 * silently reads "no session" outside a provider is a permission check that
 * fails open, and this must never become the convenient way to avoid wiring one.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext) ?? null
}
