import { useState, type FormEvent } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import {
  BREACHED_PASSWORD_MESSAGE,
  PASSWORD_MIN,
  hasNewPasswordErrors,
  validateNewPassword,
} from './authValidation'
import type { NewPasswordErrors } from './authValidation'
import { pwnedCount, type PwnedPasswordCheck } from '../../services/auth/pwnedPassword'
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
  // Breach-corpus check (`AUTH-002`), injectable exactly as on sign-up. The
  // reset flow needs it for the same reason signup does: this is where a user
  // who has just been told their password was compromised chooses the next one.
  checkPwnedPassword?: PwnedPasswordCheck
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
  checkPwnedPassword = pwnedCount,
}: UpdatePasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<NewPasswordErrors>({})
  const [checkingPassword, setCheckingPassword] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || checkingPassword) return
    const errors = validateNewPassword(password, confirmPassword)
    setFieldErrors(errors)
    if (hasNewPasswordErrors(errors)) return

    // Last, after the local checks — see the equivalent note on SignUpForm.
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
          disabled={submitting || checkingPassword}
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
          disabled={submitting || checkingPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={submitting || checkingPassword}
          disabled={!password || !confirmPassword}
        >
          Save new password
        </Button>
      </form>
    </div>
  )
}
