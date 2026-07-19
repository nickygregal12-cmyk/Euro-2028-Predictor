import { useState, type FormEvent } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import s from './auth.module.css'

export type LoginFormProps = {
  // Fired with trimmed email + raw password once the basic client checks pass.
  onSubmit: (email: string, password: string) => void
  // In-flight flag: disables inputs and spins the button.
  submitting?: boolean
  // A friendly, already-mapped error (never a raw Supabase message).
  error?: string | null
  // Navigate to the sign-up screen.
  onSwitch?: () => void
}

/**
 * Presentational log-in form. Owns its field state and shows a friendly error;
 * the parent owns the actual sign-in call and navigation. No session or Supabase
 * logic here, so it's previewable in /dev/components.
 */
export function LoginForm({ onSubmit, submitting = false, error, onSwitch }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    onSubmit(email.trim(), password)
  }

  return (
    <div className={s.card}>
      <h2 className={s.heading}>Log in</h2>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form className={s.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
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
          disabled={submitting}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={!email.trim() || !password}
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
