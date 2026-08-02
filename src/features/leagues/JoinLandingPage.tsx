import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { useAuth } from '../auth/AuthProvider'
import { AuthSplash } from '../auth/AuthSplash'
import { fetchLeaguePreview, joinLeague, type LeaguePreview } from '../../services/supabase/leagues'
import { LeaguePreviewCard } from './LeaguePreviewCard'
import { clearPendingJoin, setPendingJoin } from './pendingJoin'
import j from './join.module.css'

// Invite deep-link landing (/join/:code). Lives OUTSIDE the auth gate so it can
// handle the logged-out case itself: stash the code, send the visitor to
// sign-up, and the auth gate returns them here once signed in (see
// RedirectIfAuthed). Signed in, it shows the league preview with Join / Decline.
type State =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'ready'; preview: LeaguePreview }

export function JoinLandingPage() {
  const { code } = useParams<{ code: string }>()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [joining, setJoining] = useState(false)
  const [storedPendingCode, setStoredPendingCode] = useState<string | null>(null)

  const authed = Boolean(userId)

  // Storage is an external side effect. Persist the invite only after React has
  // committed the signed-out landing state, then allow the signup redirect.
  // Tracking the exact code prevents a route-param change from redirecting before
  // the new value has replaced the old pending invite.
  useEffect(() => {
    if (loading || authed || !code) return
    setPendingJoin(code)
    setStoredPendingCode(code)
  }, [authed, code, loading])

  useEffect(() => {
    if (!authed || !code) return
    // We've arrived signed in — the pending redirect is consumed.
    clearPendingJoin()
    let active = true
    setState({ status: 'loading' })
    fetchLeaguePreview(code)
      .then((preview) => {
        if (!active) return
        setState(preview ? { status: 'ready', preview } : { status: 'notfound' })
      })
      .catch((e) => {
        if (active)
          setState({
            status: 'error',
            message: userFacingError(e, 'Could not load the invite. Please try again.'),
          })
      })
    return () => {
      active = false
    }
  }, [authed, code])

  if (loading) return <AuthSplash />

  // Signed out: wait until the code has been committed to storage before routing
  // through sign-up. This avoids render-time mutation and guarantees that the
  // auth gate can resume the exact deep link after confirmation or login.
  if (!authed) {
    if (code && storedPendingCode !== code) return <AuthSplash />
    return <Navigate to="/auth/signup" replace />
  }

  async function join() {
    if (!code) return
    setJoining(true)
    try {
      const joined = await joinLeague(code)
      navigate(`/league/${joined.id}`, { replace: true })
    } catch (e) {
      setJoining(false)
      setState({
        status: 'error',
        message: userFacingError(e, 'Could not join the league. Please try again.'),
      })
    }
  }

  return (
    <div className={j.page}>
      <div className={j.card}>
        <p className={j.eyebrow}>Football Prediction Hub</p>
        {state.status === 'loading' && <Skeleton lines={4} />}

        {state.status === 'notfound' && (
          <>
            <Alert variant="error" title="Invite not found">
              This invite code doesn't match a league. Ask your friend for a fresh link.
            </Alert>
            <Button variant="secondary" fullWidth onClick={() => navigate('/league', { replace: true })}>
              Go to League
            </Button>
          </>
        )}

        {state.status === 'error' && (
          <>
            <Alert variant="error" title="Couldn't load the invite">
              {state.message}
            </Alert>
            <Button variant="secondary" fullWidth onClick={() => navigate('/league', { replace: true })}>
              Go to League
            </Button>
          </>
        )}

        {state.status === 'ready' && (
          <LeaguePreviewCard
            preview={state.preview}
            joining={joining}
            onJoin={join}
            onDecline={() => navigate('/league', { replace: true })}
          />
        )}
      </div>
    </div>
  )
}
