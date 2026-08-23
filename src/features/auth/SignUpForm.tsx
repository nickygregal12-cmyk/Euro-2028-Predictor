import { useEffect, useState, type FormEvent } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import { TurnstileField } from './TurnstileField'
import { turnstileEnabled } from './turnstileConfig'
import {
  BREACHED_PASSWORD_MESSAGE,
  DISPLAY_NAME_MAX,
  hasErrors,
  validateSignUp,
  type SignUpFieldErrors,
} from './authValidation'
import { pwnedCount, type PwnedPasswordCheck } from '../../services/auth/pwnedPassword'
import s from './auth.module.css'

export type SignUpFormProps = {
  onSubmit: (values: {
    displayName: string
    email: string
    password: string
    captchaToken?: string | undefined
  }) => void
  submitting?: boolean
  error?: string | null
  onSwitch?: () => void
  onGoogle?: () => void
  checkPwnedPassword?: PwnedPasswordCheck
}

export function SignUpForm({
  onSubmit,
  submitting = false,
  error,
  onSwitch,
  onGoogle,
  checkPwnedPassword = pwnedCount,
}: SignUpFormProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({})
  const [captchaValidation, setCaptchaValidation] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [checkingPassword, setCheckingPassword] = useState(false)

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || checkingPassword) return
    const values = { displayName: displayName.trim(), email: email.trim(), password }
    const errors = validateSignUp(values)
    setFieldErrors(errors)
    if (hasErrors(errors)) return

    if (turnstileEnabled && !captchaToken) {
      setCaptchaValidation(
        'Complete the security check before creating your account. If it did not load, use the retry option above.',
      )
      return
    }
    setCaptchaValidation(null)

    setCheckingPassword(true)
    let breachCount = 0
    try {
      breachCount = await checkPwnedPassword(password)
    } finally {
      setCheckingPassword(false)
    }
    if (breachCount > 0) {
      setFieldErrors({ password: BREACHED_PASSWORD_MESSAGE })
      return
    }

    onSubmit({ ...values, captchaToken: captchaToken ?? undefined })
  }

  return (
    <div className={s.card}>
      <h2 className={s.heading}>Create your account</h2>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {onGoogle ? (
        <div className={s.form}>
          <Button type="button" variant="secondary" fullWidth disabled={submitting} onClick={onGoogle}>
            Continue with Google
          </Button>
          <p className={s.switch}>You’ll choose your public football name next.</p>
          <p className={s.switch}>or create an account with email</p>
        </div>
      ) : null}
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
          disabled={submitting || checkingPassword}
          onChange={(e) => setPassword(e.target.value)}
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
          loading={submitting || checkingPassword}
          disabled={submitting || checkingPassword}
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