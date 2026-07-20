import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button } from '../../design-system'
import { signUpWithPassword } from '../../services/supabase/auth'
import { AuthScreen } from './AuthScreen'
import { SignUpForm } from './SignUpForm'
import { friendlyAuthError } from './authErrors'

/**
 * Sign-up screen. Wires the presentational SignUpForm to the auth service,
 * which creates the auth user and the matching profiles row. On success the
 * AuthProvider picks up the new session and the route gate lands the user on
 * Home.
 */
export function SignUpPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  async function handleSubmit(values: {
    displayName: string
    email: string
    password: string
  }) {
    setSubmitting(true)
    setError(null)
    try {
      const { needsConfirmation } = await signUpWithPassword(values)
      if (needsConfirmation) {
        // Confirmation enabled: there's no session, so the route gate won't move
        // us. Show a "check your email" state instead of treating it as failure.
        // (Confirmation is off today, so this path is dormant but ready.)
        setConfirmEmail(values.email)
        setSubmitting(false)
      }
      // Otherwise the session listener + route gate take over from here.
    } catch (err) {
      setError(friendlyAuthError(err, 'signup'))
      setSubmitting(false)
    }
  }

  if (confirmEmail) {
    return (
      <AuthScreen>
        <Alert variant="success" title="Almost there — check your email">
          We've sent a confirmation link to {confirmEmail}. Click it to finish setting up your
          account, then log in.
        </Alert>
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" fullWidth onClick={() => navigate('/auth/login')}>
            Back to log in
          </Button>
        </div>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen>
      <SignUpForm
        onSubmit={handleSubmit}
        submitting={submitting}
        error={error}
        onSwitch={() => navigate('/auth/login')}
      />
    </AuthScreen>
  )
}
