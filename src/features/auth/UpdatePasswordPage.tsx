import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button } from '../../design-system'
import { updatePassword } from '../../services/supabase/auth'
import { AuthScreen } from './AuthScreen'
import { AuthSplash } from './AuthSplash'
import { UpdatePasswordForm } from './UpdatePasswordForm'
import { useAuth } from './AuthProvider'
import { friendlyAuthError } from './authErrors'

// How long to wait for the recovery session to materialise before declaring the
// link invalid. The email link carries the recovery token in the URL; Supabase
// processes it and fires PASSWORD_RECOVERY, which flips `userId`. `loading`
// covers the initial session read; this grace covers the case where that read
// resolves null a beat before the recovery event lands, so we never flash the
// "expired link" error on a valid link.
const RECOVERY_GRACE_MS = 1500

/**
 * "Set a new password" screen, reached from the reset email link. It sits OUTSIDE
 * the auth gates (RedirectIfAuthed would bounce the recovery session to Home), so
 * it owns its own states: waiting for the recovery session, the form, success,
 * and the expired/invalid-link fallback.
 */
export function UpdatePasswordPage() {
  const navigate = useNavigate()
  const { userId, loading } = useAuth()
  const [graceElapsed, setGraceElapsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setGraceElapsed(true), RECOVERY_GRACE_MS)
    return () => clearTimeout(t)
  }, [])

  async function handleSave(password: string) {
    setSubmitting(true)
    setError(null)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(friendlyAuthError(err, 'update'))
      setSubmitting(false)
    }
  }

  // Still resolving the recovery session — don't decide yet.
  if (!done && (loading || (!userId && !graceElapsed))) return <AuthSplash />

  // No session after the grace: the link expired, was already used, or the page
  // was opened directly.
  if (!done && !userId) {
    return (
      <AuthScreen>
        <Alert variant="error" title="This reset link isn't valid">
          It may have expired or already been used. Request a fresh one and try again.
        </Alert>
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" fullWidth onClick={() => navigate('/auth/reset')}>
            Request a new link
          </Button>
        </div>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen>
      <UpdatePasswordForm
        onSubmit={handleSave}
        submitting={submitting}
        error={error}
        done={done}
        // The update upgraded the recovery session into a normal one, so the user
        // is signed in — send them into the app.
        onContinue={() => navigate('/', { replace: true })}
      />
    </AuthScreen>
  )
}
