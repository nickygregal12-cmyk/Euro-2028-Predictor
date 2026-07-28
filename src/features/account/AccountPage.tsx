import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  Alert,
  Button,
  ConfirmModal,
  Skeleton,
  TeamFlag,
  TextInput,
  initialsOf,
} from '../../design-system'
import { ChevronLeftIcon, ChevronRightIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { buildBracketPipeline } from '../bracket'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { ordinal } from '../league/ordinal'
import { fetchLeaderboardPage } from '../../services/supabase/leaderboard'
import {
  clearMyEntry,
  fetchAccountSettings,
  updateAccountDisplayName,
  updateDeadlineReminderPreference,
  type AccountSettings,
} from '../../services/supabase/account'
import { getCurrentSession, updateEmail, updatePassword } from '../../services/supabase/auth'
import { checkDisplayName } from '../auth/displayNamePolicy'
import { emailError, validateNewPassword } from '../auth/authValidation'
import { friendlyAuthError } from '../auth/authErrors'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import a from './account.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      settings: AccountSettings
      email: string
      totalPoints: number | null
      rank: number | null
      leaderboardAvailable: boolean
    }

export function AccountPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId, displayName, refreshProfile, signOut } = useAuth()
  const data = useTournamentData()
  const preds = usePredictions()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [nameInput, setNameInput] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<
    ReturnType<typeof validateNewPassword>
  >({})
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null)
  const [emailSaving, setEmailSaving] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [preferenceSaving, setPreferenceSaving] = useState(false)
  const [preferenceError, setPreferenceError] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  useEffect(() => {
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!userId || !tournamentId) {
      setState({ status: 'loading' })
      return
    }

    let active = true
    setState({ status: 'loading' })
    Promise.allSettled([
      fetchAccountSettings(userId),
      getCurrentSession(),
      fetchLeaderboardPage(tournamentId, { limit: 1 }),
    ]).then(([settingsRead, sessionRead, leaderboardRead]) => {
      if (!active) return
      if (settingsRead.status === 'rejected' || sessionRead.status === 'rejected') {
        const error = settingsRead.status === 'rejected' ? settingsRead.reason : sessionRead.reason
        setState({
          status: 'error',
          message: userFacingError(error, 'Could not load your account. Please try again.'),
        })
        return
      }

      const settings = settingsRead.value
      const email = sessionRead.value?.user.email ?? ''
      let totalPoints: number | null = null
      let rank: number | null = null
      let leaderboardAvailable = false
      if (leaderboardRead.status === 'fulfilled') {
        leaderboardAvailable = true
        totalPoints = leaderboardRead.value.you?.totalPoints ?? 0
        rank = leaderboardRead.value.you?.rank ?? null
      }

      setNameInput(settings.displayName)
      setState({
        status: 'ready',
        settings,
        email,
        totalPoints,
        rank,
        leaderboardAvailable,
      })
    })

    return () => {
      active = false
    }
  }, [data, reloadKey, tournamentId, userId])

  useEffect(() => {
    if (state.status !== 'ready' || location.hash !== '#display-name') return
    const section = document.getElementById('display-name')
    section?.scrollIntoView({ block: 'center' })
    section?.querySelector('input')?.focus()
  }, [location.hash, state.status])

  const champion = useMemo(() => {
    if (data.status !== 'ready' || !preds.ready) return null
    return (
      buildBracketPipeline(
        data.data,
        preds.getPrediction,
        preds.tieResolutions,
        preds.bracketProgression,
      ).champion ?? null
    )
  }, [data, preds])

  const locked = data.status !== 'ready' || isEntryLocked(data.data.tournament.lockAt)
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() ?? ''
  const supportHref = supportEmail
    ? `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(
        'Euro 2028 Predictor support',
      )}&body=${encodeURIComponent(
        `Account: ${state.status === 'ready' ? state.email : ''}\n\nHow can we help?`,
      )}`
    : null

  async function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId || state.status !== 'ready') return

    const validation = checkDisplayName(nameInput)
    setNameError(validation)
    setNameSaved(false)
    if (validation) return

    setNameSaving(true)
    try {
      const settings = await updateAccountDisplayName(userId, nameInput)
      setState((current) =>
        current.status === 'ready' ? { ...current, settings } : current,
      )
      setNameInput(settings.displayName)
      await refreshProfile()
      setNameSaved(true)
    } catch (error) {
      setNameError(friendlyAuthError(error, 'account'))
    } finally {
      setNameSaving(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateNewPassword(password, confirmPassword)
    setPasswordErrors(errors)
    setPasswordMessage(null)
    setPasswordSuccess(false)
    if (Object.keys(errors).length > 0) return

    setPasswordSaving(true)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password updated.')
      setPasswordSuccess(true)
    } catch (error) {
      setPasswordMessage(friendlyAuthError(error, 'account'))
    } finally {
      setPasswordSaving(false)
    }
  }

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = emailError(newEmail)
    setEmailFieldError(validation ?? null)
    setPendingEmail(null)
    if (validation) return

    setEmailSaving(true)
    try {
      const requested = newEmail.trim()
      await updateEmail(requested)
      setPendingEmail(requested)
      setNewEmail('')
    } catch (error) {
      setEmailFieldError(friendlyAuthError(error, 'account'))
    } finally {
      setEmailSaving(false)
    }
  }

  async function changeReminderPreference(enabled: boolean) {
    if (!userId || state.status !== 'ready' || preferenceSaving) return

    const previous = state.settings.deadlineReminderEmailsEnabled
    setPreferenceError(null)
    setPreferenceSaving(true)
    setState((current) =>
      current.status === 'ready'
        ? {
            ...current,
            settings: { ...current.settings, deadlineReminderEmailsEnabled: enabled },
          }
        : current,
    )

    try {
      await updateDeadlineReminderPreference(userId, enabled)
    } catch (error) {
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              settings: {
                ...current.settings,
                deadlineReminderEmailsEnabled: previous,
              },
            }
          : current,
      )
      setPreferenceError(
        userFacingError(error, 'Could not update your reminder preference. Please try again.'),
      )
    } finally {
      setPreferenceSaving(false)
    }
  }

  async function confirmClear() {
    if (!tournamentId || clearing) return
    setClearing(true)
    setClearError(null)
    try {
      await clearMyEntry(tournamentId)
      // The server deletes the old entry id, making queued writes against it fail
      // safely. A full navigation reload creates the new empty entry and clears
      // every in-memory prediction/version baseline in one deterministic step.
      window.location.assign('/predict')
    } catch (error) {
      setClearError(userFacingError(error, 'Could not clear your predictions. Please try again.'))
      setClearing(false)
    }
  }

  async function confirmSignOut() {
    setSigningOut(true)
    setSignOutError(null)
    try {
      await signOut()
      setSignOutOpen(false)
    } catch {
      setSignOutError("We couldn't sign you out. Check your connection and try again.")
    } finally {
      setSigningOut(false)
    }
  }

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/more')}>
        <ChevronLeftIcon size={16} /> More
      </button>
      <h1 className={s.title}>Account</h1>
      <p className={s.sub}>Private settings and account management.</p>
    </div>
  )

  if (state.status === 'loading') {
    return (
      <div className={s.page} aria-busy="true">
        {header}
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
        <div className={s.card}>
          <Skeleton lines={5} />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load your account">
          {state.message}
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  const highlights = state.leaderboardAvailable
    ? `${state.totalPoints ?? 0} pts · ${
        state.rank === null ? 'No rank yet' : `${ordinal(state.rank)} overall`
      }`
    : 'Points and rank temporarily unavailable'

  return (
    <div className={s.page}>
      {header}

      <section className={s.card} aria-labelledby="account-highlights-title">
        <span className={s.eyebrow} id="account-highlights-title">
          Your account
        </span>
        <div className={a.highlights}>
          <span className={a.avatar} aria-hidden="true">
            {initialsOf(state.settings.displayName || displayName || 'You')}
          </span>
          <span className={a.identity}>
            <span className={a.name}>{state.settings.displayName}</span>
            {champion ? (
              <span className={a.champion}>
                <TeamFlag
                  countryCode={champion.countryCode}
                  label="Champion pick"
                  size="venue"
                />
                {champion.name} champion
              </span>
            ) : null}
            <span className={a.meta}>{highlights}</span>
          </span>
          <button type="button" className={a.profileLink} onClick={() => navigate('/profile')}>
            View full profile <ChevronRightIcon size={16} />
          </button>
        </div>
      </section>

      <section className={s.card} id="display-name" aria-labelledby="display-name-title">
        <h2 className={a.sectionTitle} id="display-name-title">
          Change display name
        </h2>
        <form className={a.form} onSubmit={saveDisplayName}>
          <TextInput
            label="Display name"
            value={nameInput}
            maxLength={40}
            autoComplete="nickname"
            error={nameError ?? undefined}
            onChange={(event) => {
              setNameInput(event.target.value)
              setNameError(null)
              setNameSaved(false)
            }}
          />
          {nameSaved ? (
            <p className={a.success} role="status">
              Display name updated.
            </p>
          ) : null}
          <Button type="submit" fullWidth loading={nameSaving}>
            Save display name
          </Button>
        </form>
      </section>

      <section className={s.card} aria-labelledby="password-title">
        <h2 className={a.sectionTitle} id="password-title">
          Change password
        </h2>
        <form className={a.form} onSubmit={savePassword}>
          <TextInput
            label="New password"
            type="password"
            value={password}
            autoComplete="new-password"
            error={passwordErrors.password}
            onChange={(event) => {
              setPassword(event.target.value)
              setPasswordErrors({})
              setPasswordMessage(null)
            }}
          />
          <TextInput
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            error={passwordErrors.confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              setPasswordErrors({})
              setPasswordMessage(null)
            }}
          />
          {passwordMessage ? (
            <p className={passwordSuccess ? a.success : a.formMessage} role="status">
              {passwordMessage}
            </p>
          ) : null}
          <Button type="submit" fullWidth loading={passwordSaving}>
            Update password
          </Button>
        </form>
      </section>

      <section className={s.card} aria-labelledby="email-title">
        <h2 className={a.sectionTitle} id="email-title">
          Change email
        </h2>
        <p className={a.currentValue}>Current email: {state.email || 'Unavailable'}</p>
        <form className={a.form} onSubmit={saveEmail}>
          <TextInput
            label="New email"
            type="email"
            value={newEmail}
            autoComplete="email"
            error={emailFieldError ?? undefined}
            onChange={(event) => {
              setNewEmail(event.target.value)
              setEmailFieldError(null)
              setPendingEmail(null)
            }}
          />
          {pendingEmail ? (
            <Alert variant="info" title="Check your new email">
              We sent a confirmation link to {pendingEmail}. Your sign-in email does not change
              until that link is confirmed.
            </Alert>
          ) : null}
          <Button type="submit" fullWidth loading={emailSaving}>
            Send confirmation email
          </Button>
        </form>
      </section>

      <section className={s.card} aria-labelledby="preferences-title">
        <h2 className={a.sectionTitle} id="preferences-title">
          Preferences
        </h2>
        <div className={a.switchRow}>
          <span className={a.switchCopy}>
            <span className={a.switchLabel}>Deadline reminder emails</span>
            <span className={a.switchHint}>
              Allow reminders before the Original Predictor entry deadline.
            </span>
          </span>
          <label className={a.switch}>
            <input
              type="checkbox"
              role="switch"
              aria-label="Deadline reminder emails"
              checked={state.settings.deadlineReminderEmailsEnabled}
              disabled={preferenceSaving}
              onChange={(event) => void changeReminderPreference(event.target.checked)}
            />
            <span className={a.switchTrack} aria-hidden="true" />
          </label>
        </div>
        {preferenceError ? <Alert variant="error">{preferenceError}</Alert> : null}
      </section>

      <section className={s.card} aria-labelledby="privacy-title">
        <h2 className={a.sectionTitle} id="privacy-title">
          Privacy and visibility
        </h2>
        <ul className={a.policyList}>
          <li>Before the entry deadline, only you can see your predictions.</li>
          <li>
            After entries lock, signed-in players can inspect frozen entries, profiles and points
            breakdowns so leaderboard scoring is transparent.
          </li>
          <li>Your email address and private account settings are never shown on player profiles.</li>
        </ul>
        {supportHref ? (
          <a className={a.contactLink} href={supportHref}>
            Contact admin
          </a>
        ) : (
          <Alert variant="warning" title="Contact admin is not configured">
            Support contact details will appear here when the administrator configures them.
          </Alert>
        )}
      </section>

      <section className={`${s.card} ${a.danger}`} aria-labelledby="danger-title">
        <h2 className={a.sectionTitle} id="danger-title">
          Danger zone
        </h2>
        <div className={a.dangerActions}>
          {!locked ? (
            <Button variant="destructive" fullWidth onClick={() => setClearOpen(true)}>
              Clear my predictions
            </Button>
          ) : null}
          <Button variant="secondary" fullWidth onClick={() => setSignOutOpen(true)}>
            Sign out
          </Button>
        </div>
        <button type="button" className={a.futureRow} disabled>
          <span>Export my data</span>
          <span className={a.futureBadge}>Not available yet</span>
        </button>
        <button type="button" className={a.futureRow} disabled>
          <span>Delete account</span>
          <span className={a.futureBadge}>Not available yet</span>
        </button>
        <p className={a.futureCopy}>
          Export and account deletion will ship with the final data-retention policy.
        </p>
      </section>

      <ConfirmModal
        open={clearOpen}
        onClose={() => !clearing && setClearOpen(false)}
        onConfirm={confirmClear}
        title="Clear all predictions?"
        confirmLabel="Clear predictions"
        destructive
        loading={clearing}
      >
        <p>
          This clears all 36 scores, your bracket, jokers and awards picks. Your account, leagues
          and Bonus Games are untouched.
        </p>
        {clearError ? <p role="alert">{clearError}</p> : null}
      </ConfirmModal>

      <ConfirmModal
        open={signOutOpen}
        onClose={() => !signingOut && setSignOutOpen(false)}
        onConfirm={confirmSignOut}
        title="Sign out?"
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
      >
        <p>You'll need your password to get back in — or a reset email.</p>
        {signOutError ? <p role="alert">{signOutError}</p> : null}
      </ConfirmModal>
    </div>
  )
}
