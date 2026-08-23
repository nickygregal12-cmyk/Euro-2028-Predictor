import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import { TurnstileField } from './TurnstileField'
import { turnstileEnabled } from './turnstileConfig'
import { emailError } from './authValidation'
import s from './auth.module.css'

export type LoginFormProps = {
  // Fired with trimmed email, raw password, and the Turnstile token (undefined
  // when Turnstile is off), once the basic client checks pass.
  onSubmit: (email: string, password: string, captchaToken?: string) => void
  // In-flight flag: disables inputs and spins the button.
  submitting?: boolean
  // A friendly, already-mapped error (never a raw Supabase message).
  error?: string | null
  // Navigate to the sign-up screen.
  onSwitch?: () => void
  // Navigate to the password-reset request screen.
  onForgotPassword?: () => void
  // Hosted-only capability. Omitted until Google is configured for this build.
  onGoogle?: () => void
}

/**
 * Presentational log-in form. Owns its field state and shows friendly validation;
 * the parent owns the actual sign-in call and navigation. No session or Supabase
 * logic here, so it's previewable in /dev/components.
 */
export function LoginForm({
  onSubmit,
  submitting = false,
  error,
  onSwitch,
  onForgotPassword,
  onGoogle,
}: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailValidation, setEmailValidation] = useState<string | undefined>(undefined)
  const [passwordValidation, setPasswordValidation] = useState<string | undefined>(undefined)
  const [captchaValidation, setCaptchaValidation] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Bumping this remounts the widget to fetch a fresh, single-use token.
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

    const nextEmailError = emailError(email)
    const nextPasswordError = password ? undefined : 'Please enter your password.'
    const nextCaptchaError =
      turnstileEnabled && !captchaToken
        ? 'Complete the security check before logging in. If it did not load, use the retry option above.'
        : null

    setEmailValidation(nextEmailError)
    setPasswordValidation(nextPasswordError)
    setCaptchaValidation(nextCaptchaError)

    if (nextEmailError || nextPasswordError || nextCaptchaError) return
    onSubmit(email.trim(), password, captchaToken ?? undefined)
  }

  return (
    <div className={s.card}>
      <h2 className={s.heading}>Log in</h2>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {onGoogle ? (
        <div className={s.form}>
          <Button type="button" variant="secondary" fullWidth disabled={submitting} onClick={onGoogle}>
            Continue with Google
          </Button>
          <p className={s.switch}>or use your email</p>
        </div>
      ) : null}
      <form className={s.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          error={emailValidation}
          disabled={submitting}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          error={passwordValidation}
          disabled={submitting}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {onForgotPassword ? (
          <div className={s.forgotRow}>
            <button type="button" className={s.switchLink} onClick={onForgotPassword}>
              Forgot password?
            </button>
          </div>
        ) : null}
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
          Log in
        </Button>
      </form>
      <p className={s.switch}>
        New here?{' '}
        <button type="button" className={s.switchLink} onClick={onSwitch}>
          Create an account
        </button>
      </p>
    </div>
  )
}