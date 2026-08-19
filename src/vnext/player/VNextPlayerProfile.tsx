import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type {
  PinPanel,
  PlayerProfileModel,
  PlayerProfilePanel,
  PlayerSeasonSummary,
  RankHistoryPanel,
  RivalryPanel,
} from '../models/playerProfile'
import { accuracyRate } from '../models/playerProfile'
import { VNextShell } from '../app/VNextShell'
import { Pin } from 'lucide-react'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatNumber, formatOrdinal } from '../foundations/format'
import { accuracyValue } from './accuracy'
import { PredictionHistory } from './PredictionHistory'
import { RankChart } from './RankChart'
import { RivalryTable } from './RivalryTable'
import text from '../foundations/typography.module.css'
import styles from './playerProfile.module.css'

/**
 * vNEXT PLAYER PROFILE — WHO IS THIS PLAYER, HOW ARE THEY DOING, HOW DO WE
 * COMPARE?
 *
 * ============================ THREE PANELS, THREE PERMISSIONS ============
 *
 * The decision this page is built around. Its three reads have three different
 * server boundaries: the profile needs a SHARED PRIVATE LEAGUE, the rank
 * history and the rivalry need only contract 191's `compare`. So a player whose
 * profile is refused can still have a plotted season and a head-to-head, and
 * each panel is drawn from its OWN outcome.
 *
 * There is no page-level "permitted" here. A page that hid three panels because
 * one refused would apply a permission the server did not, and the reader would
 * be told they may not see something they may in fact see.
 *
 * ============================ THE PAGE NEVER GOES BLANK ==================
 *
 * The heading is built from whichever read ANSWERED, by a fixed priority, and
 * the two server-issued addresses come from the doorway. A refusal is a
 * sentence inside a panel, not an empty screen, and not an error page.
 *
 * WHEN ALL THREE READS FAIL THERE IS NO NAME, because the doorway carries none
 * — its intent has no name field. The page says "Player", which is the truth:
 * it knows where to look and not who it is looking at.
 *
 * ============================ THREE SENTENCES THAT ARE NOT THE SAME
 * SENTENCE =================================================================
 *
 * Refused is about PERMISSION. Not-entered is about the PLAYER. Unavailable is
 * about THE READ — and only that last one gets a retry, because the other two
 * will answer exactly the same way next time and a button promising otherwise
 * spends a press proving it.
 *
 * ============================ NOTHING HERE COMPUTES ANYTHING =============
 *
 * No clock, no sort, no rank, no rate. `accuracyRate` is the model's and refuses
 * a zero denominator; every other number on this page is one the server sent.
 */

/** Contract 157's `set_pinned_rival`, performed by the host. */
export type PlayerProfileActions = {
  readonly setPinned?: ((pinned: boolean) => Promise<{ readonly ok: boolean; readonly message?: string }>) | undefined
}

export type VNextPlayerProfileProps = {
  readonly model: PlayerProfileModel
  /**
   * Ask the host to read again. Offered ONLY beside a panel whose read failed —
   * see the header.
   */
  readonly onRetry?: (() => void) | undefined
  /**
   * A RETRY IS IN FLIGHT. The page stays mounted across one — which removed the
   * only signal a reader had that the press did anything — so this is what puts
   * the signal back without throwing the page away to do it.
   */
  readonly refreshing?: boolean | undefined
  /** The one write this page has. Absent draws no control. */
  readonly actions?: PlayerProfileActions | undefined
}

export function VNextPlayerProfile({
  model,
  onRetry,
  refreshing = false,
  actions,
}: VNextPlayerProfileProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { heading, context } = model

  return (
    <VNextShell
      destination="leagues"
      header={
        <VNextPageHeader
          /* NO READ ANSWERED, SO THE PAGE DOES NOT KNOW WHO THIS IS. "Player"
             is the honest placeholder; a remembered or guessed name would be
             the one thing on the page nobody read. */
          title={heading.displayName ?? 'Player'}
          competition={
            context.seasonLabel
              ? `${context.competitionName} · ${context.seasonLabel}`
              : context.competitionName
          }
          context={context.gameName}
        />
      }
    >
      <div className={styles.page}>
        {heading.isYou ? (
          <p className={`${text.micro} ${styles.selfNote}`} data-vnext-zone="self">
            This is your own profile.
          </p>
        ) : null}

        <PinControl panel={model.pin} setPinned={actions?.setPinned} />

        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.panels}>
          <Panel title="This season" zone="summary" busy={refreshing && model.profile.kind === 'unavailable'}>
            <ProfileBody
              panel={model.profile}
              isYou={heading.isYou}
              onRetry={onRetry}
              refreshing={refreshing}
            />
          </Panel>

          <Panel
            title="Position over the season"
            zone="rank"
            busy={refreshing && model.rankHistory.kind === 'unavailable'}
          >
            <RankBody panel={model.rankHistory} onRetry={onRetry} refreshing={refreshing} />
          </Panel>

          <Panel
            title="How you compare"
            zone="compare"
            busy={refreshing && model.rivalry.kind === 'unavailable'}
          >
            <RivalryBody panel={model.rivalry} onRetry={onRetry} refreshing={refreshing} />
          </Panel>
        </motion.div>
      </div>
    </VNextShell>
  )
}

type PanelProps = {
  readonly title: string
  readonly zone: string
  readonly busy?: boolean | undefined
  readonly children: ReactNode
}

function Panel({ title, zone, busy = false, children }: PanelProps) {
  return (
    <section className={styles.panel} data-vnext-zone={zone} aria-busy={busy || undefined}>
      {/* `h2`, BECAUSE THE SHELL OWNS THE `h1`. A panel title at `h3` skips a
          level, and a skipped level is a reader arriving at a section they
          cannot place. */}
      <h2 className={`${text.title} ${styles.panelTitle}`}>{title}</h2>
      {children}
    </section>
  )
}

/**
 * THE SENTENCE FOR A READ THAT DID NOT ANSWER, WITH THE ONE RETRY THAT MEANS
 * ANYTHING.
 *
 * The message is the live region and the control sits outside it, so the region
 * is not re-announced merely because a button re-rendered. Stage 9 settled that
 * shape in review.
 *
 * THE TEXT CHANGES WHILE A RETRY RUNS, AND THAT IS WHAT SPEAKS. Keeping the
 * page mounted across a retry means there is no `loading` render to unmount and
 * remount this region — so with fixed text a screen-reader user would hear
 * NOTHING on press, nothing on a second failure, and nothing on success. A
 * polite live region announces on a content CHANGE as well as on insertion, so
 * swapping to "Trying again…" and back is both the honest status and the
 * announcement. No key hacks, and no page thrown away to make a sentence.
 */
function Unavailable({
  what,
  onRetry,
  refreshing = false,
}: {
  readonly what: string
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean | undefined
}) {
  return (
    <div className={styles.unavailable}>
      <p className={text.body} role="status">
        {refreshing ? `Trying again…` : `We could not load ${what} just now.`}
      </p>
      {onRetry ? (
        <button
          type="button"
          className={styles.retry}
          onClick={onRetry}
          disabled={refreshing}
          aria-disabled={refreshing || undefined}
        >
          {refreshing ? 'Trying…' : 'Try again'}
        </button>
      ) : null}
    </div>
  )
}

function ProfileBody({
  panel,
  isYou,
  onRetry,
  refreshing,
}: {
  readonly panel: PlayerProfilePanel
  readonly isYou: boolean
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean | undefined
}) {
  if (panel.kind === 'unavailable') {
    return <Unavailable what="this player's season" onRetry={onRetry} refreshing={refreshing} />
  }

  if (panel.kind === 'refused') {
    /* THE SERVER'S BOUNDARY, IN WORDS, AND WITHOUT AN APOLOGY. Contract 151
     * requires a shared private league — sharing a competition is not enough,
     * because a season may have fifty thousand entrants and none of them agreed
     * to be looked up. Saying which condition is missing is more useful than
     * "not allowed", and it is not a promise that anything will change. */
    return (
      <p className={`${text.body} ${styles.panelRefused}`}>
        You share no private league with this player, so their season is private
        to you.
      </p>
    )
  }

  if (panel.kind === 'not-entered') {
    /* ABOUT THE PLAYER, NOT ABOUT PERMISSION. Contract 151 returns this
     * deliberately: a league co-member who never joined this season's game. */
    return (
      <p className={`${text.body} ${styles.panelEmpty}`}>
        This player has not entered this season&apos;s game.
      </p>
    )
  }

  const { detail } = panel

  return (
    <div className={styles.summaryBody}>
      {detail.summary === null ? (
        <p className={`${text.body} ${styles.panelEmpty}`}>
          Nothing has been banked for this player yet, so there is no standing to
          show.
        </p>
      ) : (
        <Summary summary={detail.summary} />
      )}

      {/* THREE INDEPENDENTLY NULLABLE FACTS, DRAWN INDEPENDENTLY. `summary`,
          `accuracy` and `jokers` each decode on their own — `mapAccuracy` can
          return null while `mapJokers` succeeds — so nesting one inside
          another's branch would make a malformed accuracy payload silently
          delete a player's jokers from the page. The model decouples them and
          this must not re-couple them. */}
      {detail.accuracy === null && detail.jokers === null ? null : (
        <dl className={styles.stats}>
          {detail.accuracy === null ? null : (
            <>
              <Stat
                label="Fixtures predicted"
                value={formatNumber(detail.accuracy.fixturesPredicted)}
              />
              <Stat
                label="Exact scores"
                value={accuracyValue(
                  detail.accuracy.exactScores,
                  accuracyRate(detail.accuracy)?.exact,
                )}
              />
              <Stat
                label="Correct outcomes"
                value={accuracyValue(
                  detail.accuracy.correctOutcomes,
                  accuracyRate(detail.accuracy)?.outcome,
                )}
              />
            </>
          )}
          {detail.jokers === null ? null : (
            <Stat label="Jokers played" value={formatNumber(detail.jokers.played)} />
          )}
        </dl>
      )}

      <h3 className={`${text.micro} ${styles.panelSubheading}`}>
        {/* IT COUNTS WHAT IS SHOWN AND SAYS SO. Not "of the season" — the gaps
            are the reveal boundary and are not a denominator. */}
        {formatNumber(detail.history.length)}{' '}
        {detail.history.length === 1 ? 'matchweek' : 'matchweeks'} you can see
      </h3>
      <PredictionHistory history={detail.history} isYou={isYou} />
    </div>
  )
}

function Summary({ summary }: { readonly summary: PlayerSeasonSummary }) {
  return (
    <dl className={styles.stats}>
      {/* THE RANK IS NEVER PRINTED WITHOUT ITS FIELD. 4th of six and 4th of six
          thousand are different facts, and the pair travels together from the
          decoder to here. */}
      <Stat
        label="Position"
        value={`${formatOrdinal(summary.rank)} of ${formatNumber(summary.fieldSize)}`}
      />
      <Stat label="Points" value={formatNumber(summary.points)} />
      {/* ADR 0012: points without matchweeks played is half a fact. */}
      <Stat label="Matchweeks played" value={formatNumber(summary.matchweeksPlayed)} />
    </dl>
  )
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className={styles.stat}>
      <dt className={`${text.micro} ${styles.statLabel}`}>{label}</dt>
      <dd className={styles.statValue}>{value}</dd>
    </div>
  )
}

function RankBody({
  panel,
  onRetry,
  refreshing,
}: {
  readonly panel: RankHistoryPanel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean | undefined
}) {
  switch (panel.kind) {
    case 'unavailable':
      return (
        <Unavailable what="this player's positions" onRetry={onRetry} refreshing={refreshing} />
      )
    case 'refused':
      return (
        <p className={`${text.body} ${styles.panelRefused}`}>
          This player&apos;s season positions are not visible to you.
        </p>
      )
    case 'not-entered':
      return (
        <p className={`${text.body} ${styles.panelEmpty}`}>
          This player has not entered this season&apos;s game, so there is no
          position to plot.
        </p>
      )
    case 'unaddressable':
      /* NOT A REFUSAL AND NOT A FAILURE. The doorway carried no season entry
       * reference, so the read has no address — a gap in what this build was
       * handed, and the honest thing is to say the chart is unavailable here
       * rather than to imply a permission was withheld. */
      return (
        <p className={`${text.body} ${styles.panelEmpty}`}>
          Season positions are not available from here.
        </p>
      )
    default:
      /* THE CAPTION NAMES NO ONE. The heading above already names the player,
         and repeating a name here would be a second place a heading could be
         wrong. */
      return <RankChart series={panel.series} caption="Position after each settled matchweek" />
  }
}

function RivalryBody({
  panel,
  onRetry,
  refreshing,
}: {
  readonly panel: RivalryPanel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean | undefined
}) {
  switch (panel.kind) {
    case 'unavailable':
      return <Unavailable what="your comparison" onRetry={onRetry} refreshing={refreshing} />
    case 'refused':
      return (
        <p className={`${text.body} ${styles.panelRefused}`}>
          You may not compare with this player.
        </p>
      )
    case 'not-entered':
      return (
        <p className={`${text.body} ${styles.panelEmpty}`}>
          This player has not entered this season&apos;s game, so there is
          nothing to compare.
        </p>
      )
    case 'unaddressable':
      return (
        <p className={`${text.body} ${styles.panelEmpty}`}>
          A comparison is not available from here.
        </p>
      )
    case 'self':
      /* THE RPC REFUSES IT IN TERMS — "you cannot compare yourself with
       * yourself" — and the answer would render one column twice. */
      return (
        <p className={`${text.body} ${styles.panelEmpty}`}>
          This is your own profile, so there is no one to compare with.
        </p>
      )
    default:
      /* THE COMPARISON NAMES ITSELF, from the side the server sent with it,
         rather than borrowing the page's heading. The two agree; taking the
         name from the payload that produced the columns is the one that stays
         true if they ever do not. */
      return <RivalryTable detail={panel.detail} />
  }
}

/* ==========================================================================
   PINNING A RIVAL — the one thing this page lets a reader DO
   ========================================================================== */

/**
 * A NOTE TO SELF, AND THE SERVER IS WHAT KEEPS IT ONE.
 *
 * ============================ WHY THIS IS NOT A FOLLOW ===================
 *
 * `set_pinned_rival` is season-scoped, refuses anybody the caller cannot
 * already see, tells the pinned player nothing, publishes no count and grants
 * no permission. Its own SQL says why the boundary is where it is: "a pin that
 * worked on any same-season entrant would be user discovery by another name."
 *
 * So this is not a follower graph with a quieter label, and the page has no
 * feed, no request, no reciprocity and no number attached to a person. It marks
 * somebody as one of the handful of people a player is racing, which is what
 * the Hub's Rival Watch already reads.
 *
 * ============================ WHERE IT MAY APPEAR ========================
 *
 * `not-offered` renders NOTHING AT ALL — not a greyed control and not an
 * explanation of a control that is not there. The mapper decides it, from the
 * profile read succeeding: that read requires the same shared private league
 * the write does, so a control drawn here is a control the write will accept.
 *
 * ============================ AND IT MOVES BACK IF REFUSED ===============
 *
 * The same rule the reminder switch follows. A pressed state left standing
 * after a refusal is a claim about a stored fact that is not true, and the
 * player has no way to find out.
 */
function PinControl({
  panel,
  setPinned,
}: {
  readonly panel: PinPanel
  readonly setPinned?: ((pinned: boolean) => Promise<{ readonly ok: boolean; readonly message?: string }>) | undefined
}) {
  const [shown, setShown] = useState(panel.kind === 'pinned')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The model is the authority: a reload with a new stored value moves the
  // control, rather than it keeping whatever it was last set to here.
  const stored = panel.kind === 'pinned'
  const [seen, setSeen] = useState(stored)
  if (seen !== stored) {
    setSeen(stored)
    setShown(stored)
  }

  if (panel.kind === 'not-offered' || setPinned === undefined) return null

  if (panel.kind === 'unavailable') {
    // THE READ THAT KNOWS THE STATE DID NOT ANSWER, so no control is drawn in a
    // position nobody chose. Said in a sentence rather than as a dead button.
    return (
      <p className={`${text.micro} ${styles.selfNote}`} data-vnext-zone="pin-unavailable">
        We could not tell whether you have pinned this player.
      </p>
    )
  }

  return (
    <div className={styles.pinRow} data-vnext-zone="pin">
      <button
        type="button"
        aria-pressed={shown}
        aria-busy={busy}
        className={styles.pin}
        onClick={() => {
          const next = !shown
          setShown(next)
          setError(null)
          setBusy(true)
          void setPinned(next)
            .then((result) => {
              if (result.ok) return
              setShown(!next)
              setError(result.message ?? 'We could not save that just now.')
            })
            .catch(() => {
              setShown(!next)
              setError('We could not save that just now.')
            })
            .finally(() => setBusy(false))
        }}
      >
        <Pin size={16} strokeWidth={1.75} aria-hidden="true" />
        {/* THE LABEL IS THE STATE, not an instruction. `aria-pressed` carries
            the toggle to a screen reader, and a label that read "Pin" in both
            positions would leave a sighted reader guessing which it is in. */}
        {shown ? 'Pinned as a rival' : 'Pin as a rival'}
      </button>
      {error === null ? null : (
        <p className={`${text.micro} ${styles.pinError}`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
