import { useState } from 'react'
import { motion } from 'framer-motion'
import type {
  AccountPageModel,
  FollowedCompetition,
  FollowsPanel,
  HistoryPanel,
  PlayedSeason,
} from '../models/account'
import { partitionByCompletion } from '../models/account'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
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
  | { readonly kind: 'sign-out' }
  /**
   * WHICH THEME THE PLAYER WANTS. Performed by the host because the choice is
   * persisted, and persistence is a write — the same division sign-out uses.
   * `system` is a real third answer, not the absence of one: it means "follow
   * my device", which is what a player who has never chosen already has.
   */
  | { readonly kind: 'set-theme'; readonly theme: 'system' | 'dark' | 'light' }
  /**
   * THE TWO SETTINGS THE CUTOVER MAKES THIS PAGE RESPONSIBLE FOR.
   *
   * Performed by the host for the same reason sign-out and the theme are: both
   * are writes, and this lane draws. The email change is a Supabase auth call
   * that sends a confirmation to the NEW address and applies nothing until it
   * is clicked, which is why the surface never claims the address has changed.
   */
  | { readonly kind: 'change-email'; readonly email: string }
  | { readonly kind: 'set-reminder-emails'; readonly enabled: boolean }

export type VNextAccountProps = {
  readonly model: AccountPageModel
  /** Which appearance the player has chosen. Defaults to following the device. */
  readonly theme?: 'system' | 'dark' | 'light'
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
  /** A settings write is in flight. Named so the panel disables only itself. */
  readonly settingsBusy?: 'email' | 'reminders' | null
  /**
   * What a settings write said, where it said anything.
   *
   * CARRIED WHOLE, never re-worded here — the same discipline the Championship's
   * refusal and Discovery's failed follow both follow. An email change that
   * succeeded is a NOTICE rather than a state change, because the address has
   * not changed yet: Supabase applies it only once the link in the new address
   * is clicked, and a page that said "changed" would be wrong until then.
   */
  readonly settingsNotice?: string | null
}

export function VNextAccount({
  model,
  onRetry,
  refreshing = false,
  theme = 'system',
  onIntent,
  settingsBusy = null,
  settingsNotice = null,
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
          <Follows panel={model.follows} onRetry={onRetry} refreshing={refreshing} onIntent={onIntent} />
          <History panel={model.history} onRetry={onRetry} onIntent={onIntent} />
          <Settings
            panel={model.settings}
            busy={settingsBusy}
            notice={settingsNotice}
            onIntent={onIntent}
          />
          <Session theme={theme} onIntent={onIntent} />
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

function Session({
  theme,
  onIntent,
}: {
  readonly theme: 'system' | 'dark' | 'light'
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
      )}
    </li>
  )
}

/* ==========================================================================
   SETTINGS — the two `/account` had and this page deferred
   ==========================================================================

   THE DEFERRAL WAS RIGHT AT A STAGE BOUNDARY AND WRONG AT A CUTOVER. Stage 13
   left an email-address change and the reminder-emails preference for their own
   stage, on the reasoning that a player can live a season without either. After
   the cutover this page IS `/account`: a capability that is not here is one the
   product no longer has.

   THE EMAIL CHANGE NEVER CLAIMS TO HAVE HAPPENED. Supabase sends a confirmation
   to the NEW address and applies nothing until the link in it is clicked, so
   the panel says a confirmation was sent and keeps showing the current address.
   A pending replacement is named wherever the session reports one — without it,
   a player who changed their address and has not confirmed sees the old one and
   assumes the change failed.

   THE REMINDER TOGGLE IS THE SERVER'S ANSWER, NOT AN OPTIMISTIC ONE. It is
   drawn from the profile read and re-read after the write, so a failed toggle
   leaves the control where the server actually has it rather than where the
   player pressed.
   ========================================================================== */

function Settings({
  panel,
  busy,
  notice,
  onIntent,
}: {
  readonly panel: AccountPageModel['settings']
  readonly busy: 'email' | 'reminders' | null
  readonly notice: string | null
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}) {
  const [email, setEmail] = useState('')

  // A HOST WITH NOWHERE TO SEND A WRITE GETS NO CONTROL rather than an inert
  // one — the shell's own rule, and the reason the session block does the same.
  if (panel === null || onIntent === undefined) return null

  return (
    <section className={styles.panel} data-vnext-zone="settings">
      <h2 className={`${text.title} ${styles.panelHeading}`}>Settings</h2>

      {panel.kind === 'unavailable' ? (
        <p className={`${text.body} ${styles.panelBody}`}>
          We could not read your settings just now. Your follows and your history above
          are unaffected.
        </p>
      ) : (
        <>
          <div className={styles.setting} data-vnext-zone="email">
            <p className={`${text.body} ${styles.settingLabel}`}>
              {panel.email === null
                ? 'We could not read the address on your account.'
                : `Signed in as ${panel.email}`}
            </p>
            {panel.pendingEmail === null ? null : (
              <p className={`${text.micro} ${styles.settingNote}`} data-vnext-zone="pending-email">
                Waiting for you to confirm {panel.pendingEmail}. Until you click the link in
                that message, this account still uses the address above.
              </p>
            )}
            <form
              className={styles.settingForm}
              onSubmit={(event) => {
                event.preventDefault()
                const next = email.trim()
                if (next === '' || busy !== null) return
                onIntent({ kind: 'change-email', email: next })
                setEmail('')
              }}
            >
              <label className={text.label} htmlFor="vnext-account-email">
                Change your email address
              </label>
              <input
                id="vnext-account-email"
                className={styles.settingInput}
                type="email"
                autoComplete="email"
                value={email}
                disabled={busy === 'email'}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button
                type="submit"
                className={styles.settingAction}
                disabled={busy === 'email' || email.trim() === ''}
              >
                {busy === 'email' ? 'Sending…' : 'Send confirmation'}
              </button>
            </form>
          </div>

          <div className={styles.setting} data-vnext-zone="reminders">
            <label className={styles.settingToggle}>
              <input
                type="checkbox"
                checked={panel.reminderEmails}
                disabled={busy === 'reminders'}
                onChange={(event) =>
                  onIntent({ kind: 'set-reminder-emails', enabled: event.target.checked })
                }
              />
              <span className={text.body}>Email me before a deadline</span>
            </label>
            <p className={`${text.micro} ${styles.settingNote}`}>
              Deadline reminders for matchweeks and games you are playing. Nothing else is
              ever sent to this address.
            </p>
          </div>
        </>
      )}

      {notice === null ? null : (
        <p className={`${text.micro} ${styles.settingNote}`} role="status" data-vnext-zone="settings-notice">
          {notice}
        </p>
      )}
    </section>
  )
}
