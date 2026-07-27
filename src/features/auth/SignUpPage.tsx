import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button } from '../../design-system'
import { signUpWithPassword } from '../../services/supabase/auth'
import { fetchPublicCapacity } from '../../services/supabase/publicCapacity'
import { AuthScreen } from './AuthScreen'
import { SignUpForm } from './SignUpForm'
import { friendlyAuthError } from './authErrors'

type CapacityState = 'unknown' | 'available' | 'full'

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
  const [capacityState, setCapacityState] = useState<CapacityState>('unknown')

  useEffect(() => {
    let active = true
    fetchPublicCapacity()
      .then((capacity) => {
        if (active) setCapacityState(capacity.signupAvailable ? 'available' : 'full')
      })
      .catch(() => {
        // The preflight is a convenience, not the security boundary. Leave the
        // form available and let the authoritative Auth trigger decide.
      })

    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(values: {
    displayName: string
    email: string
    password: string
    captchaToken?: string
  }) {
    setSubmitting(true)
    setError(null)
    try {
      try {
        const capacity = await fetchPublicCapacity()
        if (!capacity.signupAvailable) {
          setCapacityState('full')
          setSubmitting(false)
          return
        }
      } catch {
        // Continue to Auth. The database trigger still fails closed if the final
        // slot was taken or the capacity read was temporarily unavailable.
      }

      const { needsConfirmation } = await signUpWithPassword(values)
      if (needsConfirmation) {
        // With confirmation enabled there is no session yet, so the route gate
        // cannot move. Show the email-confirmation state explicitly.
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

  if (capacityState === 'full') {
    return (
      <AuthScreen>
        <Alert variant="warning" title="Registration is currently full">
          The predictor has reached its current public user limit. Contact admin if you need
          access.
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
