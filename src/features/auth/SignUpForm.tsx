import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import { TurnstileWidget } from './TurnstileWidget'
import { TURNSTILE_SITE_KEY, turnstileEnabled } from './turnstileConfig'
import {
  DISPLAY_NAME_MAX,
  hasErrors,
  validateSignUp,
  type SignUpFieldErrors,
} from './authValidation'
import s from './auth.module.css'

export type SignUpFormProps = {
  // Fired with trimmed display name + email, the raw password, and the Turnstile
  // token (undefined when off), once the client-side field checks pass.
  onSubmit: (values: {
    displayName: string
    email: string
    password: string
    captchaToken?: string
  }) => void
  submitting?: boolean
  // A friendly, already-mapped server error (e.g. email already in use).
  error?: string | null
  onSwitch?: () => void
}

/**
 * Presentational sign-up form: display name (required, length-limited), email
 * and password with per-field validation. The parent owns the sign-up call and
 * navigation. No Supabase logic, so it previews in /dev/components.
 */
export function SignUpForm({ onSubmit, submitting = false, error, onSwitch }: SignUpFormProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({})
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)

  // A Turnstile token is single-use; after a failed submit, reset the widget.
  useEffect(() => {
    if (error && turnstileEnabled) {
      setCaptchaToken(null)
      setCaptchaKey((k) => k + 1)
    }
  }, [error])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const values = { displayName: displayName.trim(), email: email.trim(), password }
    const errors = validateSignUp(values)
    setFieldErrors(errors)
    if (hasErrors(errors)) return
    if (turnstileEnabled && !captchaToken) return
    onSubmit({ ...values, captchaToken: captchaToken ?? undefined })
  }

  return (
    <div className={s.card}>
      <h2 className={s.heading}>Create your account</h2>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form className={s.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Display name"
          autoComplete="nickname"
          placeholder="How you'll appear on leaderboards"
          maxLength={DISPLAY_NAME_MAX}
          value={displayName}
          error={fieldErrors.displayName}
          disabled={submitting}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          error={fieldErrors.email}
          disabled={submitting}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          error={fieldErrors.password}
          hint="At least 6 characters."
          disabled={submitting}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {turnstileEnabled && TURNSTILE_SITE_KEY && (
          <TurnstileWidget
            key={captchaKey}
            siteKey={TURNSTILE_SITE_KEY}
            onToken={setCaptchaToken}
            className={s.turnstile}
          />
        )}
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={turnstileEnabled && !captchaToken}
        >
          Create account
        </Button>
      </form>
      <p className={s.switch}>
        Already have an account?{' '}
        <button type="button" className={s.switchLink} onClick={onSwitch}>
          Log in
        </button>
      </p>
    </div>
  )
}
