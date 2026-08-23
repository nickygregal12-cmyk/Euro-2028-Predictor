import { useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Button, TextInput } from '../../design-system'
import { userFacingError } from '../../shared/errors/userFacingError'
import { useAuth } from './AuthProvider'
import { checkDisplayName, DISPLAY_NAME_MAX } from './displayNamePolicy'
import { needsPublicFootballName } from './publicFootballName'
import s from './auth.module.css'

/**
 * The identity seam between authentication and football identity.
 *
 * Google may tell Supabase a real name, email and avatar. None of those are
 * public identity authority here. The server creates the neutral `Player`
 * profile when the app did not supply a display_name; this gate then requires
 * an app-owned choice before onboarding/league discovery can continue.
 */
export function PublicFootballNameGate({ children }: { children: ReactNode }) {
  const { userId, displayName, refreshProfile } = useAuth()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!needsPublicFootballName(displayName)) return <>{children}</>

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!userId || submitting) return
    const policyError = checkDisplayName(name)
    if (policyError) {
      setError(policyError)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Keep the hosted Supabase client out of this gate's module-load path.
      // Route/unit tests can import the vNext welcome tree without needing live
      // Supabase environment variables, while an actual rename still reaches
      // the existing server-moderated profile service at the moment of use.
      const { updateMyDisplayName } = await import('../../services/supabase/profile')
      await updateMyDisplayName(userId, name.trim())
      refreshProfile()
    } catch (cause) {
      setError(userFacingError(cause, 'We could not save your football name. Please try again.'))
      setSubmitting(false)
    }
  }

  return (
    <div className={s.card}>
      <p className={s.switch}>One thing before you start</p>
      <h2 className={s.heading}>Choose your football name</h2>
      <p className={s.switch}>
        This is what other players will see. Your Google name, email and profile photo are not
        used as your public identity.
      </p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form className={s.form} onSubmit={(event) => void submit(event)} noValidate>
        <TextInput
          label="Public football name"
          autoComplete="nickname"
          placeholder="How you'll appear on leaderboards"
          maxLength={DISPLAY_NAME_MAX}
          value={name}
          disabled={submitting}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Button type="submit" variant="primary" fullWidth loading={submitting} disabled={!name.trim()}>
          Continue
        </Button>
      </form>
    </div>
  )
}
