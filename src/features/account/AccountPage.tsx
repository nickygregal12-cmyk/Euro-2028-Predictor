import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Alert,
  Button,
  ConfirmModal,
  Skeleton,
  initialsOf,
} from '../../design-system'
import { ChevronRightIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
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
import { userFacingError } from '../../shared/errors/userFacingError'
import { AccountPrivacySupport } from './AccountPrivacySupport'
import { FollowedCompetitionsCard } from './FollowedCompetitionsCard'
import s from '../shared.module.css'
import a from './account.module.css'

export function AccountPage() {
  const navigate = useNavigate()
  const { userId, displayName, signOut, refreshProfile } = useAuth()

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
  const [prefError, setPrefError] = useState<string | null>(null)
  const toggleReminders = async () => {
    if (!userId || !account) return
    setPrefBusy(true)
    setPrefError(null)
    const next = !account.reminderEmails
    setAccount({ ...account, reminderEmails: next })
    try {
      await updateReminderEmails(userId, next)
    } catch {
      setAccount({ ...account, reminderEmails: !next })
      setPrefError(
        `That didn’t save — reminder emails are still ${account.reminderEmails ? 'on' : 'off'}. Try again.`,
      )
    } finally {
      setPrefBusy(false)
    }
  }

  // --- Danger zone ---------------------------------------------------------
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
            {/* No points, no rank and no predicted champion. Those are one
                competition's numbers, and this page belongs to the account
                rather than to a competition — printing a Euro 2028 total under
                a player's name told a Scottish Premiership player something
                true about a tournament they had never entered. Their standing
                lives on the surface that ranks them. */}
            <span className={a.oneLiner}>{emails.email ?? ''}</span>
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
            {/* MEASURED, NOT ASSUMED, AND RE-MEASURED ON 11 AUGUST 2026. This
                used to say nothing in the repository read `reminder_emails`.
                Contract 163 does: it schedules reminders, claims them and
                records a delivery result, and it honours this flag. What it
                deliberately does NOT do is choose a sender — `SITE-007` blocks
                the transactional provider on the brand decision, and the
                contract's `dry_run` defaults to true for exactly that reason.
                So the machinery exists and nothing leaves the building, and the
                copy says which of those two facts is which rather than
                collapsing them into a promise or into "coming soon". */}
            <span className={a.detailValue}>
              Your choice is saved and the reminder schedule is built. No email provider has been
              chosen yet, so nothing is actually sent — leaving this on will not email you today.
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
        {prefError ? <p role="alert" className={a.fieldError}>{prefError}</p> : null}
      </div>

      {/* Contract 157's preferences, edited where a player looks for a setting.
          They are a card of their own rather than rows in Preferences above,
          because Follow is a list that grows with the platform while a reminder
          toggle is one switch — and because unfollowing needs room to say that
          it removes nobody from a game. */}
      <FollowedCompetitionsCard />

      <AccountPrivacySupport
        supportEmail={import.meta.env.VITE_SUPPORT_EMAIL}
        accountEmail={emails.email}
      />

      <div className={`${s.card} ${a.danger}`}>
        <span className={s.eyebrow}>Danger zone</span>
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
