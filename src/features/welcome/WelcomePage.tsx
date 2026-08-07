import { useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { getPendingJoin } from '../leagues/pendingJoin'
import { useAuth } from '../auth/AuthProvider'
import { AuthSplash } from '../auth/AuthSplash'
import { WelcomeScreen } from './WelcomeScreen'

/**
 * Wires the one-time domestic Hub orientation. Seen-tracking fires on ENTRY
 * (mount), not on exit: the mount is the single reliable event, whereas exit
 * paths cannot all be caught reliably. Marking on entry guarantees "shown
 * exactly once" no matter how the user leaves. The gate flips to "seen"
 * optimistically in memory, so the CTA navigates instantly even before the
 * best-effort write lands.
 *
 * A first-time visitor who arrived through a league invite still sees the
 * orientation, then resumes that pending deep link. Everybody else continues
 * to the canonical weekly Hub rather than a retired tournament predictor route.
 */
export function WelcomePage() {
  const navigate = useNavigate()
  const { displayName, welcomeStatus, markWelcomed } = useAuth()

  // Capture whether the screen was actually needed on arrival, before our own
  // markWelcomed() flips the status to 'seen'. Capture the pending invite at the
  // same boundary so CTA behavior stays stable while the page is mounted.
  const neededOnArrival = useRef<boolean | null>(null)
  const pendingJoinOnArrival = useRef<string | null>(null)
  if (neededOnArrival.current === null && welcomeStatus !== 'loading') {
    neededOnArrival.current = welcomeStatus === 'needed'
    pendingJoinOnArrival.current = getPendingJoin()
  }

  useEffect(() => {
    if (neededOnArrival.current) markWelcomed()
  }, [markWelcomed, welcomeStatus])

  if (neededOnArrival.current === null) return <AuthSplash />
  if (neededOnArrival.current === false) return <Navigate to={weeklyRoutes.hub} replace />

  const pendingJoin = pendingJoinOnArrival.current

  return (
    <WelcomeScreen
      displayName={displayName}
      startLabel={pendingJoin ? 'Continue to league invite →' : undefined}
      onStart={() => navigate(pendingJoin ? `/join/${pendingJoin}` : weeklyRoutes.hub)}
      onScoring={() => navigate('/more/scoring')}
    />
  )
}
