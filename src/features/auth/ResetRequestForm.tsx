import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import { TurnstileField } from './TurnstileField'
import { turnstileEnabled } from './turnstileConfig'
import { emailError } from './authValidation'
import s from './auth.module.css'

export type ResetRequestFormProps = {
  // Fired with the trimmed email + Turnstile token (undefined when off) once the
  // basic email check passes. The parent owns the actual reset-email call.
  onSubmit: (email: string, captchaToken?: string) => void
  submitting?: boolean
  error?: string | null
  // Once the request has been made, the form flips to a neutral confirmation
  // that never reveals whether the address has an account.
  sent?: boolean
  onBackToLogin?: () => void
}

/**
 * Presentational "forgot password" request form: one email field. On success the
 * parent sets `sent`, and this shows deliberately neutral copy (email-enumeration
 * protection). No Supabase logic, so it previews in /dev/components.
 */
export function ResetRequestForm({
  onSubmit,
  submitting = false,
  error,
  sent = false,
  onBackToLogin,
}: ResetRequestFormProps) {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)
  const [captchaValidation, setCaptchaValidation] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)

  // A Turnstile token is single-use; after a failed submit, reset the widget.
  useEffect(() => {
    if (error && turnstileEnabled) {
      setCaptchaToken(null)
      setCaptchaValidation(null)
      setCaptchaKey((k) => k + 1)
    }
  }, [error])

  function handleCaptchaToken(token: string | null) {
    setCaptchaToken(token)
    if (token) setCaptchaValidation(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const err = emailError(email)
    setFieldError(err)
    if (err) return
    if (turnstileEnabled && !captchaToken) {
      setCaptchaValidation(
        'Complete the security check before requesting a reset link. If it did not load, use the retry option above.',
      )
      return
    }
    setCaptchaValidation(null)
    onSubmit(email.trim(), captchaToken ?? undefined)
  }

  if (sent) {
    return (
      <div className={s.card}>
        <h2 className={s.heading}>Check your email</h2>
        <Alert variant="success" title="Reset link sent">
          If an account exists for that email, we've sent a link to reset your password. It expires
          after a little while, so use it soon.
        </Alert>
        <Button variant="secondary" fullWidth onClick={onBackToLogin}>
          Back to log in
        </Button>
      </div>
    )
  }

  return (
    <div className={s.card}>
      <h2 className={s.heading}>Reset your password</h2>
      <p className={s.tagline}>Enter your email and we'll send you a link to set a new one.</p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form className={s.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          error={fieldError}
          disabled={submitting}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {/* Renders nothing when Turnstile is off, and — when it is on but
            cannot load — explains that and offers a retry rather than leaving
            the visitor with an inert form. */}
        <TurnstileField
          resetKey={captchaKey}
          onToken={handleCaptchaToken}
          className={s.turnstile}
        />
        {captchaValidation ? <Alert variant="error">{captchaValidation}</Alert> : null}
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={submitting}
        >
          Send reset link
        </Button>
      </form>
      <p className={s.switch}>
        Remembered it?{' '}
        <button type="button" className={s.switchLink} onClick={onBackToLogin}>
          Back to log in
        </button>
      </p>
    </div>
  )
}
