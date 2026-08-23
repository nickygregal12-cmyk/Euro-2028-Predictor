import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { useAuth } from '../auth/AuthProvider'
import { needsPublicFootballName } from '../auth/publicFootballName'
import { clearPendingJoin, getPendingJoin } from '../leagues/pendingJoin'

export type WelcomeHost =
  | { readonly kind: 'checking' }
  | { readonly kind: 'seen' }
  | {
      readonly kind: 'run'
      readonly displayName: string | null
      readonly finish: () => void
    }

export function useWelcomeHost(): WelcomeHost {
  const navigate = useNavigate()
  const { displayName, welcomeStatus, markWelcomed } = useAuth()

  const neededOnArrival = useRef<boolean | null>(null)
  const pendingJoinOnArrival = useRef<string | null>(null)
  if (neededOnArrival.current === null && welcomeStatus !== 'loading') {
    // `welcomed_at` remains the onboarding gate, but a neutral OAuth profile is
    // also first-entry work. This second predicate is intentionally derived
    // from app-owned profile state, never Google user_metadata.
    neededOnArrival.current =
      welcomeStatus === 'needed' || needsPublicFootballName(displayName)
    pendingJoinOnArrival.current = getPendingJoin()
  }

  useEffect(() => {
    if (neededOnArrival.current && welcomeStatus === 'needed') markWelcomed()
  }, [markWelcomed, welcomeStatus])

  const finish = useCallback(() => {
    const pending = pendingJoinOnArrival.current
    if (pending) {
      clearPendingJoin()
      navigate(`/join/${pending}`, { replace: true })
      return
    }
    navigate(weeklyRoutes.hub, { replace: true })
  }, [navigate])

  if (neededOnArrival.current === null) return { kind: 'checking' }
  if (neededOnArrival.current === false) return { kind: 'seen' }
  return { kind: 'run', displayName, finish }
}