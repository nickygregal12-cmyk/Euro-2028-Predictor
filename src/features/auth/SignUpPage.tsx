import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button } from '../../design-system'
import { signInWithGoogle, signUpWithPassword } from '../../services/supabase/auth'
import { fetchPublicCapacity } from '../../services/supabase/publicCapacity'
import { AuthScreen } from './AuthScreen'
import { SignUpForm } from './SignUpForm'
import { friendlyAuthError } from './authErrors'
import { googleAuthEnabled } from './googleAuthConfig'

type CapacityState = 'unknown' | 'available' | 'full'

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
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(values: {
    displayName: string
    email: string
    password: string
    captchaToken?: string | undefined
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
      } catch {}

      const { needsConfirmation } = await signUpWithPassword(values)
      if (needsConfirmation) {
        setConfirmEmail(values.email)
        setSubmitting(false)
      }
    } catch (err) {
      setError(friendlyAuthError(err, 'signup'))
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setSubmitting(true)
    setError(null)
    try {
      // Capacity remains authoritative in the database trigger. The preflight is
      // useful feedback only; OAuth must not become a route around the cap.
      try {
        const capacity = await fetchPublicCapacity()
        if (!capacity.signupAvailable) {
          setCapacityState('full')
          setSubmitting(false)
          return
        }
      } catch {}
      await signInWithGoogle()
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
        onGoogle={googleAuthEnabled ? () => void handleGoogle() : undefined}
        onSwitch={() => navigate('/auth/login')}
      />
    </AuthScreen>
  )
}