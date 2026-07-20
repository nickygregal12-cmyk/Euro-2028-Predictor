import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendPasswordReset } from '../../services/supabase/auth'
import { AuthScreen } from './AuthScreen'
import { ResetRequestForm } from './ResetRequestForm'
import { friendlyAuthError } from './authErrors'

/**
 * "Forgot password" request screen (signed-out; sits under RedirectIfAuthed with
 * log in / sign up). Sends the reset email and flips to a neutral confirmation.
 * We show the confirmation even on the rare error paths would be wrong — but a
 * genuine error (network, rate limit, missing captcha) is surfaced so the user
 * can retry; unknown-email is not an error (Supabase doesn't reveal it).
 */
export function ResetRequestPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(email: string, captchaToken?: string) {
    setSubmitting(true)
    setError(null)
    try {
      await sendPasswordReset(email, captchaToken)
      setSent(true)
    } catch (err) {
      setError(friendlyAuthError(err, 'reset'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthScreen>
      <ResetRequestForm
        onSubmit={handleSubmit}
        submitting={submitting}
        error={error}
        sent={sent}
        onBackToLogin={() => navigate('/auth/login')}
      />
    </AuthScreen>
  )
}
