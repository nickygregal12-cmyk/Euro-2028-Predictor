import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  getCurrentSession,
  onAuthChange,
  signOut as serviceSignOut,
} from '../../services/supabase/auth'
import { fetchMyProfile } from '../../services/supabase/profile'
import { initDevAuth } from '../../services/supabase/devAutoLogin'

// Session state for the whole app. While auth screens are deferred the session
// is established by the dev auto-login shim (docs/auth-plan.md §1); this provider
// treats it exactly as it will treat a real signed-in session — nothing here
// special-cases the dev user (CLAUDE.md rule 8).

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
    await serviceSignOut()
    // Dev only: there are no auth screens yet, so immediately re-run the
    // auto-login shim to return to a signed-in state (docs/auth-plan.md §1). In
    // a production build initDevAuth is a no-op, so this is a plain sign-out.
    await initDevAuth()
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
