import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  getCurrentSession,
  onAuthChange,
  signOut as serviceSignOut,
} from '../../services/supabase/auth'
import { fetchMyProfile } from '../../services/supabase/profile'

// Session state for the whole app. The session is established either by real
// auth screens (log in / sign up) or, in a dev build, by the auto-login shim on
// startup (docs/auth-plan.md §1). This provider treats every session the same
// way — nothing here special-cases the dev user (CLAUDE.md rule 8).

type AuthContextValue = {
  userId: string | null
  displayName: string | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
      return
    }
    let active = true
    fetchMyProfile(userId)
      .then((profile) => {
        if (active) setDisplayName(profile?.displayName ?? null)
      })
      .catch(() => {
        if (active) setDisplayName(null)
      })
    return () => {
      active = false
    }
  }, [userId])

  async function signOut() {
    // A real sign-out: clear the session and let the route gate show the auth
    // screens. The dev auto-login shim only runs at startup (main.tsx), so
    // signing out no longer bounces straight back in — a full reload in a dev
    // build with the flag on will auto-login again, which is expected.
    await serviceSignOut()
  }

  return (
    <AuthContext.Provider value={{ userId, displayName, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
