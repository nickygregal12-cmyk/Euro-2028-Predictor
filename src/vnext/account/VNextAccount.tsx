import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type {
  AccountPageModel,
  AccountRules,
  AccountSettingsPanel,
  AccountSupport,
  FollowedCompetition,
  FollowsPanel,
  HistoryPanel,
  PlayedSeason,
} from '../models/account'
import { partitionByCompletion } from '../models/account'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { ShellOverlay } from '../app/ShellOverlay'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './account.module.css'

/**
 * vNEXT ACCOUNT / YOU.
 *
 * ============================ IT ANSWERS A DEAD BUTTON ==================
 *
 * `shell.ts` has emitted a `kind: 'account'` intent from every vNext surface
 * since Stage 8 — from the desktop rail and the mobile top bar, both rendered
 * as the signed-in player's own initials and name — and no vNext surface has
 * ever answered it. The dev harnesses route it to the LEGACY `/account` page,
 * so pressing your own name currently leaves vNext altogether. This is the
 * answer.
 *
 * IT IS NOT ONE OF THE FOUR DESTINATIONS. `home | matches | games | leagues`
 * are, and none of them should light up while the player is here, so this
 * renders with `destination="none"`.
 *
 * ============================ TWO PANELS, TWO READS ======================
 *
 * Follows (contract 157) and season history (contract 161) resolve separately
 * and are drawn separately. Neither is a fallback for the other, and neither
 * failing may blank the other — the reason each has its own union rather than
 * the page having one "loaded".
 *
 * ============================ WHAT IT WILL NOT SAY =======================
 *
 * A COMPETITION'S NAME IT DOES NOT HAVE. A follow the catalogue no longer
 * lists and the player never played cannot be named by any read this page
 * makes. It renders as a follow the page cannot name, not as a uuid and not as
 * a plausible guess.
 *
 * WHICH CLUB IS THE FAVOURITE. Contract 157 carries an id; resolving it is one
 * competition-scoped read per follow. The page says a favourite is set and
 * sends the player to the competition, where that read already happens.
 *
 * A LINK TO A SEASON THAT CANNOT BE OPENED. Contract 161 supplies a null slug
 * for a season the catalogue no longer publishes, and its own header says
 * saying "archived" beats rendering a link that goes nowhere.
 */

/**
 * WHAT THIS PAGE ASKS ITS HOST TO DO.
 *
 * `manage-follow` USED TO BE HERE AND WAS NEVER EMITTED — a declared intent no
 * control produced, in a lane whose whole discipline is that a control exists
 * only where the server would accept it. Following and unfollowing belong to
 * Discovery, which has the read that knows the current state and the control
 * that changes it; a second entry point on this page would be a second place
 * for the same write to disagree about what it was toggling.
 *
 * `sign-out` IS PERFORMED BY THE HOST, like every other write this lane draws.
 * The page owns the control and the wording; the session belongs to the
 * application's auth provider, and a presentation component that ends a session
 * is a presentation component that has to know about one.
 */
export type AccountIntent =
  | { readonly kind: 'open-season'; readonly competitionSlug: string; readonly seasonKey: string }
  /**
   * OPEN A FINISHED SEASON'S WRAPPED (contract 156).
   *
   * Separate from `open-season` because it is a different place: opening a
   * season lands on the competition as it is now, and this lands on the record
   * of how it ended. Offered only on a season the player's own history says is
   * COMPLETE, so the page is never reached expecting a record that cannot exist
   * yet.
   */
  | {
      readonly kind: 'open-wrapped'
      readonly competitionSlug: string
      readonly seasonKey: string
    }
  | { readonly kind: 'sign-out' }
  /**
   * WHICH THEME THE PLAYER WANTS. Performed by the host because the choice is
   * persisted, and persistence is a write — the same division sign-out uses.
   * `system` is a real third answer, not the absence of one: it means "follow
   * my device", which is what a player who has never chosen already has.
   */
  | { readonly kind: 'set-theme'; readonly theme: 'system' | 'dark' | 'light' }
  /**
   * WHETHER THIS DEVICE BUZZES. Performed by the host for the same reason the
   * theme is: the choice is persisted, and persistence is a write.
   *
   * `system` is a real third answer here too — it means "not chosen", which
   * resolves to on. A device with no motor already answers `unsupported`
   * without anybody asking, so this is not a capability switch: it is a player
   * saying they would rather not be buzzed.
   */
  | { readonly kind: 'set-haptics'; readonly haptics: 'system' | 'on' | 'off' }

/**
 * WHAT A WRITE ANSWERED, IN THE TWO SHAPES A SHEET CAN DRAW.
 *
 * A refusal carries the application's own sentence. The page states the
 * constraints it was given as NUMBERS — a length, a minimum — and everything
 * else is the server's answer repeated, because the display-name moderation
 * policy is mirrored by a database trigger and a second copy here would be the
 * one that went stale.
 */
export type AccountWriteResult = { readonly ok: true } | { readonly ok: false; readonly message: string }

/**
 * THE WRITES, PERFORMED BY THE HOST — Stage 7's rule, applied to a settings
 * surface.
 *
 * The page owns the control, the wording, the local checks it can state and the
 * busy and error presentation. The application owns the request, the policy and
 * the session. A presentation component that called `updateEmail` would be a
 * presentation component that had to know about an auth provider.
 *
 * `undefined` IS "THIS HOST CANNOT DO THAT", and the row is not drawn. A
 * control that exists and refuses teaches a player the product is broken.
 */
export type AccountActions = {
  readonly setDisplayName?: ((name: string) => Promise<AccountWriteResult>) | undefined
  readonly setPassword?: ((password: string) => Promise<AccountWriteResult>) | undefined
  readonly setEmail?: ((email: string) => Promise<AccountWriteResult>) | undefined
  readonly setReminderEmails?: ((on: boolean) => Promise<AccountWriteResult>) | undefined
}

export type VNextAccountProps = {
  readonly model: AccountPageModel
  /** Which appearance the player has chosen. Defaults to following the device. */
  readonly theme?: 'system' | 'dark' | 'light'
  /** The player's haptic choice, held by the host that persists it. */
  readonly haptics?: 'system' | 'on' | 'off'
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
  /** The writes this host can perform. Absent members draw no control. */
  readonly actions?: AccountActions | undefined
}

export function VNextAccount({
  model,
  onRetry,
  refreshing = false,
  theme = 'system',
  haptics = 'system',
  onIntent,
  actions,
}: VNextAccountProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { context } = model

  return (
    <VNextShell
      destination="none"
      header={
        <VNextPageHeader
          title="You"
          competition={context.displayName ?? 'Your account'}
          context="Account"
        />
      }
    >
      <div className={styles.page}>
        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          {/* YOU FIRST. The page is an overview of a person, and the person is
              the first thing on it — name, address, and the short list of
              things they can change about themselves. */}
          <Settings
            panel={model.settings}
            displayName={context.displayName}
            actions={actions}
            onRetry={onRetry}
          />
          <Follows panel={model.follows} onRetry={onRetry} refreshing={refreshing} onIntent={onIntent} />
          <History panel={model.history} onRetry={onRetry} onIntent={onIntent} />
          <PrivacyAndSupport support={model.support} />
          <Session theme={theme} haptics={haptics} onIntent={onIntent} />
        </motion.div>
      </div>
    </VNextShell>
  )
}

/* ==========================================================================
   SESSION
   ========================================================================== */

/**
 * SIGNING OUT, WHICH IS THE ONE PIECE OF `/account`'s SETTINGS THAT CUTOVER
 * CANNOT DO WITHOUT.
 *
 * The route matrix defines `/account` as "settings, follow/unfollow, favourite
 * team". Follow and favourite are Discovery's and the competition's; of the
 * settings proper, changing an email address and the reminder-emails toggle can
 * wait for their own stage — a player can live a season without either. Not
 * being able to sign out of the product is different, and a cutover that
 * shipped it would be a cutover that stranded every shared device.
 */
const THEMES = [
  { id: 'system', label: 'Match my device' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
] as const

/**
 * THE THREE ANSWERS ABOUT BEING BUZZED.
 *
 * WORDED AS WHAT IT DOES, NOT AS THE TECHNOLOGY. "Vibration" is what the device
 * calls it; "a short buzz when something lands" is what a player experiences,
 * and the copy says so without promising a device can do it. A phone with no
 * motor simply never buzzes, and nothing here is the only way to understand any
 * state — which is the rule that makes this safe to offer at all.
 */
const HAPTICS = [
  { id: 'system', label: 'Match my device' },
  { id: 'on', label: 'On' },
  { id: 'off', label: 'Off' },
] as const

function Session({
  theme,
  haptics,
  onIntent,
}: {
  readonly theme: 'system' | 'dark' | 'light'
  readonly haptics: 'system' | 'on' | 'off'
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  if (onIntent === undefined) return null
  return (
    <section className={styles.panel} data-vnext-zone="session">
      <h2 className={`${text.title} ${styles.panelHeading}`}>This device</h2>

      {/* A RADIO GROUP, NOT A TOGGLE. There are three answers and a toggle can
          only hold two — and the one it drops is "follow my device", which is
          what most people actually want and what they have before they ever
          open this page. */}
      <fieldset className={styles.themeChoice}>
        <legend className={text.label}>Appearance</legend>
        {THEMES.map((entry) => (
          <label key={entry.id} className={styles.themeOption} data-selected={theme === entry.id}>
            <input
              type="radio"
              name="vnext-theme"
              value={entry.id}
              checked={theme === entry.id}
              onChange={() => onIntent({ kind: 'set-theme', theme: entry.id })}
              className={text.srOnly}
            />
            <span>{entry.label}</span>
          </label>
        ))}
      </fieldset>

      {/* A SEPARATE PREFERENCE FROM MOTION, DELIBERATELY. A vestibular
          preference and a preference about being vibrated are held by different
          people for different reasons, and nothing in this product's authority
          says one implies the other. Reduced motion is the device's and is
          honoured everywhere; this is its own answer. */}
      <fieldset className={styles.themeChoice}>
        <legend className={text.label}>Haptic feedback</legend>
        {HAPTICS.map((entry) => (
          <label
            key={entry.id}
            className={styles.themeOption}
            data-selected={haptics === entry.id}
          >
            <input
              type="radio"
              name="vnext-haptics"
              value={entry.id}
              checked={haptics === entry.id}
              onChange={() => onIntent({ kind: 'set-haptics', haptics: entry.id })}
              className={text.srOnly}
            />
            <span>{entry.label}</span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        className={styles.signOut}
        onClick={() => onIntent({ kind: 'sign-out' })}
      >
        Sign out
      </button>
    </section>
  )
}

/* ==========================================================================
   SETTINGS — a short list of rows, and one sheet at a time
   ========================================================================== */

/**
 * WHAT A PLAYER MAY CHANGE ABOUT THEMSELVES, WITHOUT BECOMING A SETTINGS PAGE.
 *
 * ============================ WHY ROWS AND NOT FORMS =====================
 *
 * The legacy `/account` opens four forms at once and the result is a column of
 * empty inputs where a player came to check one thing. A row STATES WHAT IT
 * HOLDS — the name they are known by, the address the emails go to — which is
 * most of what the visit was for, and it opens a sheet only when they want to
 * change it.
 *
 * ============================ ONE SHEET, ONE JOB =========================
 *
 * Pressing "Email address" opens a sheet about the email address. Three fields
 * behind one backdrop would be the legacy page with a scrim in front of it, and
 * it would make a player choosing a new password read past two inputs that have
 * nothing to do with them.
 *
 * ============================ A PREFERENCE IS A SWITCH ===================
 *
 * Reminder emails toggles in place and saves immediately. A one-tap choice put
 * behind a sheet, a field and a Save button is a one-tap choice turned into a
 * task. It reports its own failure beside itself and RETURNS TO WHERE IT WAS —
 * a switch left in the position the write refused is a switch lying about a
 * stored preference.
 *
 * ============================ AND NOTHING IS OFFERED THAT CANNOT BE DONE =
 *
 * A row exists only where the host supplied its action AND the read behind it
 * landed. The whole panel is absent when the read failed, which is why the
 * switch is never drawn off by default: `false` would be a decision shown to a
 * player who never made it.
 */

type SettingsJob = 'display-name' | 'password' | 'email'

const JOB_TITLES: Readonly<Record<SettingsJob, string>> = {
  'display-name': 'Change your display name',
  password: 'Change your password',
  email: 'Change your email address',
}

/**
 * A VERB AND ITS OBJECT, never a bare "Save".
 *
 * Written out rather than derived from the title by string surgery: a label a
 * player reads is not a place for a `replace()` that quietly produces something
 * ungrammatical the first time a title is reworded.
 */
const JOB_SUBMIT: Readonly<Record<SettingsJob, string>> = {
  'display-name': 'Change display name',
  password: 'Change password',
  email: 'Change email address',
}

function Settings({
  panel,
  displayName,
  actions,
  onRetry,
}: {
  readonly panel: AccountSettingsPanel
  readonly displayName: string | null
  readonly actions?: AccountActions | undefined
  readonly onRetry?: (() => void) | undefined
}) {
  const [job, setJob] = useState<SettingsJob | null>(null)

  if (panel.kind === 'unavailable') {
    return (
      <section className={styles.panel} data-vnext-zone="settings">
        <h2 className={`${text.title} ${styles.panelHeading}`}>Your details</h2>
        {/* NOT A PANEL OF EMPTY FIELDS, and above all not a switch drawn off.
            "We could not read your settings" and "reminder emails are off" are
            different sentences and only one of them is about the player. */}
        <div className={styles.empty}>
          <p className={text.body}>We could not load your account details just now.</p>
          {onRetry === undefined ? null : (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </section>
    )
  }

  const rows: readonly { job: SettingsJob; label: string; value: string }[] = [
    ...(actions?.setDisplayName
      ? [
          {
            job: 'display-name' as const,
            label: 'Display name',
            // The name other players see. `null` is a real state — the profile
            // read has no name — and it is said rather than left blank.
            value: displayName ?? 'Not set',
          },
        ]
      : []),
    ...(actions?.setPassword
      ? [{ job: 'password' as const, label: 'Password', value: '••••••••' }]
      : []),
    ...(actions?.setEmail && panel.email.kind === 'known'
      ? [{ job: 'email' as const, label: 'Email address', value: panel.email.address }]
      : []),
  ]

  const pending = panel.email.kind === 'known' ? panel.email.pending : null

  // NO HEADING OVER NOTHING. A host that supplied no writes gets no "Your
  // details" section at all rather than an empty one — Stage 13's rule that the
  // page must not head a section it cannot fill, kept now that it can fill one.
  if (rows.length === 0 && !actions?.setReminderEmails) return null

  return (
    <section className={styles.panel} data-vnext-zone="settings">
      <h2 className={`${text.title} ${styles.panelHeading}`}>Your details</h2>

      {rows.length === 0 ? null : (
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.job}>
              <button
                type="button"
                className={styles.row}
                data-vnext-setting={row.job}
                // THE NAME IS WRITTEN OUT. Three text nodes joined with no
                // separator would be announced as one run-on string, and
                // "Change" alone would be the vague button the brief names.
                aria-label={`${row.label}: ${row.value}. Change`}
                onClick={() => setJob(row.job)}
              >
                <span className={styles.rowText}>
                  <span className={`${text.micro} ${styles.rowLabel}`}>{row.label}</span>
                  <span className={`${text.body} ${styles.rowValue}`}>{row.value}</span>
                </span>
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* BOTH ADDRESSES ARE REAL IN THIS WINDOW. Saying only the old one tells
          the player their change did not happen; saying only the new one tells
          them it has. */}
      {pending === null ? null : (
        <p className={`${text.micro} ${styles.note}`} data-vnext-zone="email-pending">
          {pending} is waiting to be confirmed. Open the link we sent there to
          finish the change — until then, emails still go to your current
          address.
        </p>
      )}

      {panel.email.kind === 'unknown' && actions?.setEmail ? (
        <p className={`${text.micro} ${styles.note}`} data-vnext-zone="email-unknown">
          We could not read which email address this account uses.
        </p>
      ) : null}

      {actions?.setReminderEmails ? (
        <ReminderSwitch
          on={panel.reminderEmails}
          save={actions.setReminderEmails}
        />
      ) : null}

      {job === null ? null : (
        <SettingsSheet
          job={job}
          rules={panel.rules}
          currentName={displayName}
          actions={actions}
          onClose={() => setJob(null)}
        />
      )}
    </section>
  )
}

/**
 * THE PREFERENCE, AS A SWITCH THAT TELLS THE TRUTH.
 *
 * It moves optimistically, because a control that waits for a round trip feels
 * broken — and it MOVES BACK when the write refuses, because the position of
 * this switch is a claim about a stored preference and a wrong one is worse
 * than a slow one.
 *
 * `aria-busy` rather than `disabled` while saving: disabling a control the
 * moment it is pressed takes focus off it in some browsers, and a player who
 * pressed it twice has told the server twice, which is idempotent here.
 */
function ReminderSwitch({
  on,
  save,
}: {
  readonly on: boolean
  readonly save: (next: boolean) => Promise<AccountWriteResult>
}) {
  const [shown, setShown] = useState(on)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The model is the authority. When a reload brings a new stored value, the
  // switch follows it rather than keeping whatever it was last set to here.
  const [seen, setSeen] = useState(on)
  if (seen !== on) {
    setSeen(on)
    setShown(on)
  }

  return (
    <div className={styles.switchRow} data-vnext-zone="reminder-emails">
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-busy={busy}
        className={styles.switch}
        onClick={() => {
          const next = !shown
          setShown(next)
          setError(null)
          setBusy(true)
          void save(next)
            .then((result) => {
              if (result.ok) return
              // BACK TO WHERE IT WAS. The switch states a stored fact.
              setShown(!next)
              setError(result.message)
            })
            .catch(() => {
              setShown(!next)
              setError('We could not save that just now.')
            })
            .finally(() => setBusy(false))
        }}
      >
        <span className={styles.switchTrack} aria-hidden="true">
          <span className={styles.switchThumb} />
        </span>
        <span className={styles.switchText}>
          <span className={`${text.body} ${styles.rowValue}`}>Reminder emails</span>
          <span className={`${text.micro} ${styles.rowLabel}`}>
            A nudge before your predictions lock.
          </span>
        </span>
      </button>
      {error === null ? null : (
        <p className={`${text.micro} ${styles.error}`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * ONE SHEET, ONE JOB.
 *
 * `ShellOverlay` IS REUSED RATHER THAN REBUILT, and its own header says why: a
 * real `dialog` with a real name, focus that enters, Escape that closes, focus
 * that returns to the control that was pressed, and a scrim that is not a
 * control. Writing that a fourth time is how the fourth one ends up without an
 * Escape handler. It is a bottom sheet on a phone and a centred panel on a
 * desktop, decided in CSS against the shell's container.
 *
 * THE CHECKS IT MAKES ARE THE ONES IT WAS TOLD. A length and a minimum, both
 * numbers on the model, plus "the two passwords match" — which is a fact about
 * this form and about nothing on the server. Everything else is the write's own
 * refusal, printed verbatim.
 */
function SettingsSheet({
  job,
  rules,
  currentName,
  actions,
  onClose,
}: {
  readonly job: SettingsJob
  readonly rules: AccountRules
  readonly currentName: string | null
  readonly actions?: AccountActions | undefined
  readonly onClose: () => void
}) {
  const [value, setValue] = useState(job === 'display-name' ? (currentName ?? '') : '')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const fieldRef = useRef<HTMLInputElement>(null)

  const localError = ((): string | null => {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    if (job === 'display-name' && trimmed.length > rules.displayNameMaxLength) {
      return `Keep it to ${rules.displayNameMaxLength} characters or fewer.`
    }
    if (job === 'password') {
      if (value.length < rules.passwordMinLength) {
        return `Use at least ${rules.passwordMinLength} characters.`
      }
      if (confirm.length > 0 && confirm !== value) return 'The two passwords do not match.'
    }
    return null
  })()

  const ready =
    value.trim().length > 0 &&
    localError === null &&
    (job !== 'password' || confirm === value)

  function submit() {
    const run =
      job === 'display-name'
        ? actions?.setDisplayName?.(value.trim())
        : job === 'password'
          ? actions?.setPassword?.(value)
          : actions?.setEmail?.(value.trim())
    if (!run) return

    setBusy(true)
    setError(null)
    void run
      .then((result) => {
        if (result.ok) {
          setDone(
            job === 'email'
              ? 'Check the new address for a confirmation link. Nothing changes until you open it.'
              : 'Saved.',
          )
          return
        }
        setError(result.message)
      })
      .catch(() => setError('We could not save that just now.'))
      .finally(() => setBusy(false))
  }

  return (
    <ShellOverlay title={JOB_TITLES[job]} initialFocusRef={fieldRef} onClose={onClose}>
      {done === null ? (
        <form
          className={styles.sheet}
          data-vnext-zone="settings-sheet"
          data-job={job}
          onSubmit={(event) => {
            event.preventDefault()
            if (ready && !busy) submit()
          }}
        >
          <label className={styles.field}>
            <span className={`${text.micro} ${styles.rowLabel}`}>
              {job === 'display-name'
                ? 'New display name'
                : job === 'password'
                  ? 'New password'
                  : 'New email address'}
            </span>
            <input
              ref={fieldRef}
              className={styles.input}
              type={job === 'password' ? 'password' : job === 'email' ? 'email' : 'text'}
              value={value}
              // The constraint is stated before the refusal rather than learnt
              // from it — the same rule the Penalty Number lane follows.
              maxLength={job === 'display-name' ? rules.displayNameMaxLength : undefined}
              autoComplete={
                job === 'password' ? 'new-password' : job === 'email' ? 'email' : 'nickname'
              }
              onChange={(event) => setValue(event.target.value)}
            />
          </label>

          {job === 'password' ? (
            <label className={styles.field}>
              <span className={`${text.micro} ${styles.rowLabel}`}>Repeat new password</span>
              <input
                className={styles.input}
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          ) : null}

          {job === 'password' ? (
            <p className={`${text.micro} ${styles.note}`}>
              At least {rules.passwordMinLength} characters.
            </p>
          ) : null}

          {localError === null ? null : (
            <p className={`${text.micro} ${styles.error}`}>{localError}</p>
          )}
          {error === null ? null : (
            <p className={`${text.micro} ${styles.error}`} role="alert">
              {error}
            </p>
          )}

          <div className={styles.sheetActions}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              Cancel
            </button>
            {/* A player reading this button out of context still knows what it
                will do. See `JOB_SUBMIT`. */}
            <button type="submit" className={styles.primary} disabled={!ready || busy}>
              {busy ? 'Saving…' : JOB_SUBMIT[job]}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.sheet} data-vnext-zone="settings-done">
          <p className={text.body} role="status">
            {done}
          </p>
          <div className={styles.sheetActions}>
            <button type="button" className={styles.primary} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </ShellOverlay>
  )
}

/* ==========================================================================
   PRIVACY AND SUPPORT
   ========================================================================== */

/**
 * WHAT OTHER PLAYERS CAN SEE, AND HOW TO ASK A HUMAN.
 *
 * ============================ WHY IT IS HERE AND NOT IN A DIRECTORY ======
 *
 * "Who can see my predictions?" is a question about YOU, and this is the page
 * about you. The legacy answer lived on `/account` beside the settings and was
 * also reachable from `/more`; the matrix absorbs the directory, and putting
 * the answer anywhere else would mean a player has to know it is a "help" topic
 * before they can find out whether their predictions are private.
 *
 * ============================ THE THREE SENTENCES ARE THE REVEAL RULE ====
 *
 * They are not reassurance copy. Contract 151's per-matchweek reveal boundary
 * is what the first two describe, and the season player surface enforces it by
 * ABSENCE. If that rule ever changes these sentences are wrong, which is why
 * they are three short facts and not a paragraph that could stay vaguely true.
 *
 * ============================ AND THE LINK IS REAL OR IT IS ABSENT =======
 *
 * `unconfigured` renders a sentence, not a disabled button. A player who cannot
 * reach an administrator should be told that plainly rather than pressing
 * something that does nothing.
 */
function PrivacyAndSupport({ support }: { readonly support: AccountSupport }) {
  return (
    <section className={styles.panel} data-vnext-zone="privacy">
      <h2 className={`${text.title} ${styles.panelHeading}`}>Privacy and help</h2>
      <ul className={styles.privacy}>
        <li className={text.body}>Before entries lock, only you can see your predictions.</li>
        <li className={text.body}>
          After lock, signed-in players can inspect frozen entries, profiles and points
          breakdowns, so the leaderboard can be checked.
        </li>
        <li className={text.body}>
          Your email address and account settings are never shown on a profile.
        </li>
      </ul>
      {support.kind === 'available' ? (
        <a className={styles.support} href={support.href} data-vnext-zone="support">
          Email an administrator
        </a>
      ) : (
        <p className={`${text.micro} ${styles.note}`} data-vnext-zone="support-absent">
          No administrator address has been set up for this deployment yet.
        </p>
      )}
    </section>
  )
}

/* ==========================================================================
   FOLLOWS
   ========================================================================== */

function Follows({
  panel,
  onRetry,
  refreshing,
  onIntent,
}: {
  readonly panel: FollowsPanel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing: boolean
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  return (
    <section className={styles.panel} data-vnext-zone="follows">
      <h2 className={`${text.title} ${styles.panelHeading}`}>Competitions you follow</h2>

      {panel.kind === 'unavailable' ? (
        <div className={styles.empty}>
          <p className={text.body}>We could not load what you follow just now.</p>
          {onRetry === undefined ? null : (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : panel.kind === 'empty' ? (
        // A REAL ANSWER, and phrased as one. "You follow nothing" and "we could
        // not find out" send a player to different screens, so they read
        // differently here too.
        <p className={`${text.body} ${styles.empty}`} data-vnext-zone="follows-empty">
          You are not following any competitions yet.
        </p>
      ) : (
        <ul className={styles.list} data-refreshing={refreshing || undefined}>
          {panel.competitions.map((competition) => (
            <FollowRow key={competition.tournamentId} competition={competition} onIntent={onIntent} />
          ))}
        </ul>
      )}
    </section>
  )
}

function FollowRow({
  competition,
  onIntent,
}: {
  readonly competition: FollowedCompetition
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  const { identity, favourite } = competition

  return (
    <li className={styles.row} data-vnext-follow={identity.kind}>
      <div className={styles.rowMain}>
        {identity.kind === 'named' ? (
          <>
            <p className={`${text.body} ${styles.rowTitle}`}>{identity.competitionName}</p>
            <p className={`${text.micro} ${styles.rowMeta}`}>{identity.seasonName}</p>
          </>
        ) : (
          // NOT A UUID AND NOT A GUESS. The follow is real; the name is not
          // available from any read this page makes.
          <>
            <p className={`${text.body} ${styles.rowTitle}`}>A competition you follow</p>
            <p className={`${text.micro} ${styles.rowMeta}`}>
              We cannot show its name here — it is no longer in the catalogue and
              you have not played a season of it.
            </p>
          </>
        )}

        {favourite.kind === 'set' ? (
          // THE FACT, NOT THE CLUB. See the model: naming it is one extra read
          // per follow, and it belongs beside the competition anyway.
          <p className={`${text.micro} ${styles.rowMeta}`} data-vnext-zone="favourite">
            You have picked a favourite club for this competition.
          </p>
        ) : null}
      </div>

      {identity.kind === 'named' && identity.route !== null ? (
        <button
          type="button"
          className={styles.rowAction}
          onClick={() =>
            onIntent?.({
              kind: 'open-season',
              competitionSlug: identity.route!.competitionSlug,
              seasonKey: identity.route!.seasonKey,
            })
          }
        >
          Open
          <span className={text.srOnly}> {identity.competitionName}</span>
        </button>
      ) : null}
    </li>
  )
}

/* ==========================================================================
   SEASON HISTORY
   ========================================================================== */

function History({
  panel,
  onRetry,
  onIntent,
}: {
  readonly panel: HistoryPanel
  readonly onRetry?: (() => void) | undefined
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  return (
    <section className={styles.panel} data-vnext-zone="history">
      <h2 className={`${text.title} ${styles.panelHeading}`}>Your seasons</h2>

      {panel.kind === 'unavailable' ? (
        <div className={styles.empty}>
          <p className={text.body}>We could not load your seasons just now.</p>
          {onRetry === undefined ? null : (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : panel.kind === 'empty' ? (
        <p className={`${text.body} ${styles.empty}`} data-vnext-zone="history-empty">
          You have not played a season yet.
        </p>
      ) : (
        <Seasons panel={panel} onIntent={onIntent} />
      )}
    </section>
  )
}

function Seasons({
  panel,
  onIntent,
}: {
  readonly panel: Extract<HistoryPanel, { kind: 'seasons' }>
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  // GROUPED, NOT SORTED. `partitionByCompletion` keeps the server's order
  // inside each group; contract 161 ordered its own seasons and nothing here
  // re-ranks. It groups on the season's own `complete`, never on whether a
  // Wrapped exists to print — see the model.
  const { finished, ongoing } = partitionByCompletion(panel.seasons)

  return (
    <>
      {ongoing.length === 0 ? null : (
        <>
          <h3 className={`${text.micro} ${styles.groupHeading}`}>Still going</h3>
          <ul className={styles.list} data-vnext-zone="ongoing">
            {ongoing.map((season) => (
              <SeasonRow key={season.tournamentId} season={season} onIntent={onIntent} />
            ))}
          </ul>
        </>
      )}

      {finished.length === 0 ? null : (
        <>
          <h3 className={`${text.micro} ${styles.groupHeading}`}>Finished</h3>
          <ul className={styles.list} data-vnext-zone="finished">
            {finished.map((season) => (
              <SeasonRow key={season.tournamentId} season={season} onIntent={onIntent} />
            ))}
          </ul>
        </>
      )}

      {panel.hasMore ? (
        // THE SERVER'S OWN PAGING FACT. Stated rather than silently truncating,
        // so a player with a long history knows this is not all of it.
        <p className={`${text.micro} ${styles.groupHeading}`} data-vnext-zone="has-more">
          Showing {panel.seasons.length} of {panel.total} seasons.
        </p>
      ) : null}
    </>
  )
}

function SeasonRow({
  season,
  onIntent,
}: {
  readonly season: PlayedSeason
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  return (
    <li className={styles.row} data-vnext-season={season.tournamentId}>
      <div className={styles.rowMain}>
        <p className={`${text.body} ${styles.rowTitle}`}>{season.seasonName}</p>
        {season.competitionName === null ? null : (
          <p className={`${text.micro} ${styles.rowMeta}`}>{season.competitionName}</p>
        )}

        {season.result === null ? null : (
          <p className={`${text.micro} ${styles.rowMeta}`} data-vnext-zone="result">
            <strong className={text.numeric}>{season.result.points}</strong> points
            {season.result.rank === null ? null : (
              <>
                {' · finished '}
                <strong className={text.numeric}>{season.result.rank}</strong>
                {season.result.fieldSize === null ? null : ` of ${season.result.fieldSize}`}
              </>
            )}
            {` · ${season.result.matchweeksPlayed} matchweeks`}
          </p>
        )}

        {season.games.length === 0 ? null : (
          <p className={`${text.micro} ${styles.rowMeta}`} data-vnext-zone="games">
            {season.games.map((game) => game.gameName).join(' · ')}
          </p>
        )}

        {season.inPublishedCatalogue ? null : (
          // ARCHIVED IS A FACT, and a better one than a link that goes nowhere.
          <p className={`${text.micro} ${styles.archived}`} data-vnext-zone="archived">
            Archived — no longer in the catalogue.
          </p>
        )}
      </div>

      {season.route === null ? null : (
        <span className={styles.rowActions}>
          {/* THE WRAPPED IS OFFERED ONLY ON A SEASON THAT IS OVER, and
              `complete` is contract 161's own word for that — never `result !==
              null`, because a finished season whose archive row has not been
              written is still finished. The page answers for both. */}
          {season.complete ? (
            <button
              type="button"
              className={styles.rowAction}
              onClick={() =>
                onIntent?.({
                  kind: 'open-wrapped',
                  competitionSlug: season.route!.competitionSlug,
                  seasonKey: season.route!.seasonKey,
                })
              }
            >
              Your season
              <span className={text.srOnly}> in {season.seasonName}</span>
            </button>
          ) : null}
          <button
            type="button"
            className={styles.rowAction}
            onClick={() =>
              onIntent?.({
                kind: 'open-season',
                competitionSlug: season.route!.competitionSlug,
                seasonKey: season.route!.seasonKey,
              })
            }
          >
            Open
            <span className={text.srOnly}> {season.seasonName}</span>
          </button>
        </span>
      )}
    </li>
  )
}
