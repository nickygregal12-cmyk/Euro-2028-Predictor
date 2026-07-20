import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
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

  const authed = Boolean(userId)

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
            message: e instanceof Error ? e.message : 'Could not load the invite.',
          })
      })
    return () => {
      active = false
    }
  }, [authed, code])

  if (loading) return <AuthSplash />

  // Signed out: remember the code and route through sign-up.
  if (!authed) {
    if (code) setPendingJoin(code)
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
        message: e instanceof Error ? e.message : 'Could not join the league.',
      })
    }
  }

  return (
    <div className={j.page}>
      <div className={j.card}>
        <p className={j.eyebrow}>Euro 2028 Predictor</p>
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
