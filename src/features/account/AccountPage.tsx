import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Alert,
  Button,
  ConfirmModal,
  Skeleton,
  TeamFlag,
  initialsOf,
} from '../../design-system'
import { ChevronRightIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { buildBracketPipeline } from '../bracket/bracketPipeline'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { checkDisplayName, DISPLAY_NAME_MAX } from '../auth/displayNamePolicy'
import { friendlyAuthError } from '../auth/authErrors'
import { validateNewPassword, hasNewPasswordErrors } from '../auth/authValidation'
import {
  getSessionEmailState,
  updateEmail,
  updatePassword,
} from '../../services/supabase/auth'
import {
  fetchMyAccount,
  updateMyDisplayName,
  updateReminderEmails,
} from '../../services/supabase/profile'
import { clearMyPredictions } from '../../services/supabase/predictions'
import { fetchLeaderboardPage } from '../../services/supabase/leaderboard'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import a from './account.module.css'

export function AccountPage() {
  const navigate = useNavigate()
  const { userId, displayName, signOut, refreshProfile } = useAuth()
  const data = useTournamentData()
  const preds = usePredictions()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const locked =
    data.status === 'ready' ? isEntryLocked(data.data.tournament.lockAt) : true

  // Headline: points + rank (pre-results guard as on the Profile page).
  const [headline, setHeadline] = useState<{
    points: number
    rank: number | null
  } | null>(null)
  useEffect(() => {
    if (!tournamentId) return
    let active = true
    fetchLeaderboardPage(tournamentId, { limit: 1 })
      .then((page) => {
        if (!active) return
        const preResults = page.totalCount === 0 || page.rows[0]?.rank === null
        setHeadline({
          points: page.you?.totalPoints ?? 0,
          rank: preResults ? null : (page.you?.rank ?? null),
        })
      })
      .catch(() => {
        if (active) setHeadline(null)
      })
    return () => {
      active = false
    }
  }, [tournamentId])

  // Account details (name + preferences) and the email state.
  const [account, setAccount] = useState<{
    displayName: string
    reminderEmails: boolean
  } | null>(null)
  const [emails, setEmails] = useState<{
    email: string | null
    pendingEmail: string | null
  }>({ email: null, pendingEmail: null })
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountNonce, setAccountNonce] = useState(0)
  useEffect(() => {
    if (!userId) return
    let active = true
    Promise.all([fetchMyAccount(userId), getSessionEmailState()])
      .then(([mine, emailState]) => {
        if (!active) return
        if (mine) setAccount(mine)
        setEmails(emailState)
        setAccountError(null)
      })
      .catch((error) => {
        if (active)
          setAccountError(
            userFacingError(error, 'Could not load your account details.'),
          )
      })
    return () => {
      active = false
    }
  }, [userId, accountNonce])

  const champion =
    data.status === 'ready' && preds.ready
      ? buildBracketPipeline(
          data.data,
          preds.getPrediction,
          preds.tieResolutions,
          preds.bracketProgression,
        ).champion
      : null

  // --- Change display name -------------------------------------------------
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSaved, setNameSaved] = useState(false)
  const saveName = async () => {
    if (!userId || nameDraft === null) return
    const trimmed = nameDraft.trim()
    const clientError = checkDisplayName(trimmed)
    if (clientError) {
      setNameError(clientError)
      return
    }
    setNameBusy(true)
    setNameError(null)
    try {
      await updateMyDisplayName(userId, trimmed)
      refreshProfile()
      setAccountNonce((nonce) => nonce + 1)
      setNameDraft(null)
      setNameSaved(true)
    } catch (error) {
      setNameError(friendlyAuthError(error, 'update'))
    } finally {
      setNameBusy(false)
    }
  }

  // --- Change password -----------------------------------------------------
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [password1, setPassword1] = useState('')
  const [password2, setPassword2] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordDone, setPasswordDone] = useState(false)
  const savePassword = async () => {
    const errors = validateNewPassword(password1, password2)
    if (hasNewPasswordErrors(errors)) {
      setPasswordError(errors.password ?? errors.confirmPassword ?? 'Check the passwords.')
      return
    }
    setPasswordBusy(true)
    setPasswordError(null)
    try {
      await updatePassword(password1)
      setPasswordDone(true)
      setPasswordOpen(false)
      setPassword1('')
      setPassword2('')
    } catch (error) {
      setPasswordError(friendlyAuthError(error, 'update'))
    } finally {
      setPasswordBusy(false)
    }
  }

  // --- Change email --------------------------------------------------------
  const [emailDraft, setEmailDraft] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const saveEmail = async () => {
    if (emailDraft === null) return
    setEmailBusy(true)
    setEmailError(null)
    try {
      await updateEmail(emailDraft.trim())
      setEmailDraft(null)
      setAccountNonce((nonce) => nonce + 1)
    } catch (error) {
      setEmailError(friendlyAuthError(error, 'update'))
    } finally {
      setEmailBusy(false)
    }
  }

  // --- Preferences ---------------------------------------------------------
  const [prefBusy, setPrefBusy] = useState(false)
  const toggleReminders = async () => {
    if (!userId || !account) return
    setPrefBusy(true)
    const next = !account.reminderEmails
    setAccount({ ...account, reminderEmails: next })
    try {
      await updateReminderEmails(userId, next)
    } catch {
      setAccount({ ...account, reminderEmails: !next })
    } finally {
      setPrefBusy(false)
    }
  }

  // --- Danger zone ---------------------------------------------------------
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const doClear = async () => {
    if (!tournamentId) return
    setClearing(true)
    setClearError(null)
    try {
      await clearMyPredictions(tournamentId)
      preds.retryInitialLoad()
      setClearOpen(false)
    } catch (error) {
      setClearError(
        userFacingError(error, 'Your predictions could not be cleared.'),
      )
    } finally {
      setClearing(false)
    }
  }

  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const doSignOut = async () => {
    setSigningOut(true)
    setSignOutError(null)
    try {
      await signOut()
      setSignOutOpen(false)
    } catch {
      setSignOutError('We couldn’t sign you out. Check your connection and try again.')
    } finally {
      setSigningOut(false)
    }
  }

  const name = account?.displayName ?? displayName ?? ''

  return (
    <div className={s.page}>
      <div className={s.header}>
        <span className={s.eyebrow}>Private to you</span>
        <h1 className={s.title}>Account</h1>
      </div>

      <div className={s.card}>
        <div className={a.highlights}>
          <span className={a.avatar} aria-hidden="true">
            {initialsOf(name || '?')}
          </span>
          <div className={a.identity}>
            <span className={a.name}>{name || <Skeleton lines={1} />}</span>
            <span className={a.oneLiner}>
              {headline
                ? `${headline.points} pts${headline.rank !== null ? ` · ${headline.rank}${ordinal(headline.rank)} overall` : ''}`
                : 'Standings update once results land'}
            </span>
            {champion ? (
              <span className={a.champion}>
                <TeamFlag
                  countryCode={champion.countryCode}
                  label={champion.name}
                  size="table"
                />
                {champion.name}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className={a.linkRow}
          onClick={() => navigate('/profile')}
        >
          View full profile
          <ChevronRightIcon size={18} className={a.chev} />
        </button>
      </div>

      {accountError ? (
        <Alert variant="warning" title="Couldn’t load your details">
          {accountError}
          <div style={{ marginTop: 10 }}>
            <Button
              variant="secondary"
              onClick={() => setAccountNonce((nonce) => nonce + 1)}
            >
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className={s.card}>
        <span className={s.eyebrow}>Details</span>

        <div className={a.detailRow}>
          <div className={a.detailBody}>
            <span className={a.detailLabel}>Display name</span>
            {nameDraft === null ? (
              <span className={a.detailValue}>{name || '—'}</span>
            ) : (
              <input
                className={a.input}
                value={nameDraft}
                maxLength={DISPLAY_NAME_MAX}
                aria-label="New display name"
                onChange={(event) => setNameDraft(event.target.value)}
              />
            )}
            {nameError ? <p role="alert" className={a.fieldError}>{nameError}</p> : null}
            {nameSaved && nameDraft === null ? (
              <p className={a.fieldOk}>Name updated.</p>
            ) : null}
          </div>
          {nameDraft === null ? (
            <Button variant="secondary" onClick={() => { setNameDraft(name); setNameSaved(false) }}>
              Change
            </Button>
          ) : (
            <Button onClick={saveName} disabled={nameBusy}>
              {nameBusy ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>

        <div className={a.detailRow}>
          <div className={a.detailBody}>
            <span className={a.detailLabel}>Password</span>
            {passwordOpen ? (
              <>
                <input
                  className={a.input}
                  type="password"
                  autoComplete="new-password"
                  aria-label="New password"
                  placeholder="New password"
                  value={password1}
                  onChange={(event) => setPassword1(event.target.value)}
                />
                <input
                  className={a.input}
                  type="password"
                  autoComplete="new-password"
                  aria-label="Repeat new password"
                  placeholder="Repeat new password"
                  value={password2}
                  onChange={(event) => setPassword2(event.target.value)}
                />
              </>
            ) : (
              <span className={a.detailValue}>
                {passwordDone ? 'Password changed.' : '••••••••'}
              </span>
            )}
            {passwordError ? (
              <p role="alert" className={a.fieldError}>{passwordError}</p>
            ) : null}
          </div>
          {passwordOpen ? (
            <Button onClick={savePassword} disabled={passwordBusy}>
              {passwordBusy ? 'Saving…' : 'Save'}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => { setPasswordOpen(true); setPasswordDone(false) }}>
              Change
            </Button>
          )}
        </div>

        <div className={a.detailRow}>
          <div className={a.detailBody}>
            <span className={a.detailLabel}>Email</span>
            {emailDraft === null ? (
              <span className={a.detailValue}>{emails.email ?? '—'}</span>
            ) : (
              <input
                className={a.input}
                type="email"
                autoComplete="email"
                aria-label="New email address"
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
              />
            )}
            {emails.pendingEmail ? (
              <p className={a.fieldOk}>
                {emails.pendingEmail} — pending confirmation. Check that inbox.
              </p>
            ) : null}
            {emailError ? <p role="alert" className={a.fieldError}>{emailError}</p> : null}
          </div>
          {emailDraft === null ? (
            <Button variant="secondary" onClick={() => setEmailDraft(emails.email ?? '')}>
              Change
            </Button>
          ) : (
            <Button onClick={saveEmail} disabled={emailBusy}>
              {emailBusy ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      <div className={s.card}>
        <span className={s.eyebrow}>Preferences</span>
        <label className={a.prefRow}>
          <span className={a.detailBody}>
            <span className={a.detailLabel}>Deadline reminder emails</span>
            <span className={a.detailValue}>
              A nudge before predictions lock. Off means no reminder emails, ever.
            </span>
          </span>
          <input
            type="checkbox"
            className={a.toggle}
            checked={account?.reminderEmails ?? true}
            disabled={prefBusy || !account}
            onChange={toggleReminders}
          />
        </label>
      </div>

      <div className={`${s.card} ${a.danger}`}>
        <span className={s.eyebrow}>Danger zone</span>
        {!locked ? (
          <div className={a.detailRow}>
            <div className={a.detailBody}>
              <span className={a.detailLabel}>Clear my predictions</span>
              <span className={a.detailValue}>
                Wipes your entry back to empty. Pre-lock only.
              </span>
            </div>
            <Button variant="destructive" onClick={() => setClearOpen(true)}>
              Clear…
            </Button>
          </div>
        ) : null}
        <div className={a.detailRow}>
          <div className={a.detailBody}>
            <span className={a.detailLabel}>Sign out</span>
          </div>
          <Button variant="destructive" onClick={() => setSignOutOpen(true)}>
            Sign out
          </Button>
        </div>
        <div className={a.detailRow}>
          <div className={a.detailBody}>
            <span className={a.detailLabel}>Delete account & export my data</span>
            <span className={a.detailValue}>Coming with the data-export build.</span>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={doClear}
        title="Clear all your predictions?"
        confirmLabel="Clear everything"
        destructive
        loading={clearing}
      >
        <p>
          This clears all 36 scores, your bracket, jokers and awards picks. Your
          account and leagues are untouched.
        </p>
        {clearError ? <p role="alert">{clearError}</p> : null}
      </ConfirmModal>

      <ConfirmModal
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={doSignOut}
        title="Sign out?"
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
      >
        <p>You’ll need your password to get back in — or a reset email.</p>
        {signOutError ? <p role="alert">{signOutError}</p> : null}
      </ConfirmModal>
    </div>
  )
}

function ordinal(rank: number): string {
  const tens = rank % 100
  if (tens >= 11 && tens <= 13) return 'th'
  const unit = rank % 10
  return unit === 1 ? 'st' : unit === 2 ? 'nd' : unit === 3 ? 'rd' : 'th'
}
