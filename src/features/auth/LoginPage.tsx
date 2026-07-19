import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPassword } from '../../services/supabase/auth'
import { AuthScreen } from './AuthScreen'
import { LoginForm } from './LoginForm'
import { friendlyAuthError } from './authErrors'

/**
 * Log-in screen. Wires the presentational LoginForm to the auth service; on
 * success the AuthProvider's onAuthChange fires and the RedirectIfAuthed gate
 * sends the user to Home, so there's no manual navigate on success.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(email: string, password: string) {
    setSubmitting(true)
    setError(null)
    try {
      await signInWithPassword(email, password)
      // Success: the auth listener flips the session and the route gate
      // redirects to Home. Keep the button spinning until that unmount.
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
        onSwitch={() => navigate('/auth/signup')}
      />
    </AuthScreen>
  )
}
