import { useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthSplash } from '../auth/AuthSplash'
import { WelcomeScreen } from './WelcomeScreen'

/**
 * Wires the welcome screen. Seen-tracking fires on ENTRY (mount), not on exit:
 * the mount is the single reliable event, whereas exit paths (Start, the rules
 * link, the back button, a direct nav-away, tab close) can't all be caught
 * reliably — beforeunload can't await a DB write. Marking on entry guarantees
 * "shown exactly once" no matter how the user leaves. The gate flips to "seen"
 * optimistically in memory, so the CTA navigates instantly even before the write
 * lands; the write itself is idempotent (keeps the first-seen timestamp).
 *
 * A user who has already been welcomed but lands here (bookmark / direct nav) is
 * bounced to Home — the screen is never shown twice.
 */
export function WelcomePage() {
  const navigate = useNavigate()
  const { displayName, welcomeStatus, markWelcomed } = useAuth()

  // Capture whether the screen was actually needed on arrival, before our own
  // markWelcomed() flips the status to 'seen'.
  const neededOnArrival = useRef<boolean | null>(null)
  if (neededOnArrival.current === null && welcomeStatus !== 'loading') {
    neededOnArrival.current = welcomeStatus === 'needed'
  }

  useEffect(() => {
    if (neededOnArrival.current) markWelcomed()
  }, [markWelcomed, welcomeStatus])

  if (neededOnArrival.current === null) return <AuthSplash />
  if (neededOnArrival.current === false) return <Navigate to="/" replace />

  return (
    <WelcomeScreen
      displayName={displayName}
      onStart={() => navigate('/predict/groups/A')}
      onScoring={() => navigate('/more/scoring')}
    />
  )
}
