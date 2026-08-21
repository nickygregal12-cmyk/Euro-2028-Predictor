import { useState } from 'react'
import { useNavigate } from 'react-router'
import { signInWithGoogle, signInWithPassword } from '../../services/supabase/auth'
import { AuthScreen } from './AuthScreen'
import { LoginForm } from './LoginForm'
import { friendlyAuthError } from './authErrors'
import { googleAuthEnabled } from './googleAuthConfig'

export function LoginPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(email: string, password: string, captchaToken?: string) {
    setSubmitting(true)
    setError(null)
    try {
      await signInWithPassword(email, password, captchaToken)
    } catch (err) {
      setError(friendlyAuthError(err, 'login'))
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setSubmitting(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(friendlyAuthError(err, 'login'))
      setSubmitting(false)
    }
  }

  return (
    <AuthScreen>
      <LoginForm
        onSubmit={handleSubmit}
        submitting={submitting}
        error={error}
        onGoogle={googleAuthEnabled ? () => void handleGoogle() : undefined}
        onSwitch={() => navigate('/auth/signup')}
        onForgotPassword={() => navigate('/auth/reset')}
      />
    </AuthScreen>
  )
}