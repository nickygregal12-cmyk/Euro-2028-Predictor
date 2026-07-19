import { useState, type FormEvent } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import {
  DISPLAY_NAME_MAX,
  hasErrors,
  validateSignUp,
  type SignUpFieldErrors,
} from './authValidation'
import s from './auth.module.css'

export type SignUpFormProps = {
  // Fired with trimmed display name + email and the raw password, only once the
  // client-side field checks pass.
  onSubmit: (values: { displayName: string; email: string; password: string }) => void
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const values = { displayName: displayName.trim(), email: email.trim(), password }
    const errors = validateSignUp(values)
    setFieldErrors(errors)
    if (hasErrors(errors)) return
    onSubmit(values)
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
        <Button type="submit" variant="primary" fullWidth loading={submitting}>
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
