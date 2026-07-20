import { useState, type FormEvent } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import { PASSWORD_MIN, hasNewPasswordErrors, validateNewPassword } from './authValidation'
import type { NewPasswordErrors } from './authValidation'
import s from './auth.module.css'

export type UpdatePasswordFormProps = {
  // Fired with the new password once the client checks pass. The parent runs the
  // update against the recovery session and owns navigation.
  onSubmit: (password: string) => void
  submitting?: boolean
  error?: string | null
  // Set once the password has been changed — shows the confirmation + Continue.
  done?: boolean
  onContinue?: () => void
}

/**
 * Presentational "set a new password" form: new password + confirm. Reached from
 * the reset email link, where a recovery session is already active. No Supabase
 * logic here, so it previews in /dev/components.
 */
export function UpdatePasswordForm({
  onSubmit,
  submitting = false,
  error,
  done = false,
  onContinue,
}: UpdatePasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<NewPasswordErrors>({})

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const errors = validateNewPassword(password, confirmPassword)
    setFieldErrors(errors)
    if (hasNewPasswordErrors(errors)) return
    onSubmit(password)
  }

  if (done) {
    return (
      <div className={s.card}>
        <h2 className={s.heading}>Password updated</h2>
        <Alert variant="success" title="You're all set">
          Your password has been changed and you're signed in.
        </Alert>
        <Button variant="primary" fullWidth onClick={onContinue}>
          Continue to the app
        </Button>
      </div>
    )
  }

  return (
    <div className={s.card}>
      <h2 className={s.heading}>Set a new password</h2>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form className={s.form} onSubmit={handleSubmit} noValidate>
        <TextInput
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          error={fieldErrors.password}
          hint={`At least ${PASSWORD_MIN} characters.`}
          disabled={submitting}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <TextInput
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Type it again"
          value={confirmPassword}
          error={fieldErrors.confirmPassword}
          disabled={submitting}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={!password || !confirmPassword}
        >
          Save new password
        </Button>
      </form>
    </div>
  )
}
