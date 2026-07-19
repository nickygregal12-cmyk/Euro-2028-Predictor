import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  async function handleSubmit(values: {
    displayName: string
    email: string
    password: string
  }) {
    setSubmitting(true)
    setError(null)
    try {
      await signUpWithPassword(values)
      // Success: the session listener + route gate take over from here.
    } catch (err) {
      setError(friendlyAuthError(err, 'signup'))
      setSubmitting(false)
    }
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
