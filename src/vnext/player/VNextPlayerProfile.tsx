import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type {
  PlayerProfileModel,
  PlayerProfilePanel,
  PlayerSeasonSummary,
  RankHistoryPanel,
  RivalryPanel,
} from '../models/playerProfile'
import { accuracyRate } from '../models/playerProfile'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatNumber, formatOrdinal, formatShare } from '../foundations/format'
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
 * The heading is built from what the DOORWAY held — a name and two server-issued
 * addresses — so it is present whatever the three reads did. A refusal is a
 * sentence inside a panel, not an empty screen, and not an error page.
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

export type VNextPlayerProfileProps = {
  readonly model: PlayerProfileModel
  /**
   * Ask the host to read again. Offered ONLY beside a panel whose read failed —
   * see the header.
   */
  readonly onRetry?: (() => void) | undefined
}

export function VNextPlayerProfile({ model, onRetry }: VNextPlayerProfileProps) {
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

        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.panels}>
          <Panel title="This season" zone="summary">
            <ProfileBody panel={model.profile} isYou={heading.isYou} onRetry={onRetry} />
          </Panel>

          <Panel title="Position over the season" zone="rank">
            <RankBody panel={model.rankHistory} onRetry={onRetry} />
          </Panel>

          <Panel title="How you compare" zone="compare">
            <RivalryBody panel={model.rivalry} onRetry={onRetry} />
          </Panel>
        </motion.div>
      </div>
    </VNextShell>
  )
}

type PanelProps = {
  readonly title: string
  readonly zone: string
  readonly children: ReactNode
}

function Panel({ title, zone, children }: PanelProps) {
  return (
    <section className={styles.panel} data-vnext-zone={zone}>
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
 * The message is the live region and the control sits outside it, so a second
 * failure is announced to a reader who just asked for exactly this answer
 * without the button re-announcing itself. Stage 9 settled this shape in
 * review; it is the same one here.
 */
function Unavailable({ what, onRetry }: { readonly what: string; readonly onRetry?: (() => void) | undefined }) {
  return (
    <div className={styles.unavailable}>
      <p className={text.body} role="status">
        We could not load {what} just now.
      </p>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

function ProfileBody({
  panel,
  isYou,
  onRetry,
}: {
  readonly panel: PlayerProfilePanel
  readonly isYou: boolean
  readonly onRetry?: (() => void) | undefined
}) {
  if (panel.kind === 'unavailable') {
    return <Unavailable what="this player's season" onRetry={onRetry} />
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

      {detail.accuracy === null ? null : (
        <dl className={styles.stats}>
          <Stat label="Fixtures predicted" value={formatNumber(detail.accuracy.fixturesPredicted)} />
          <Stat
            label="Exact scores"
            value={rateValue(detail.accuracy.exactScores, accuracyRate(detail.accuracy)?.exact)}
          />
          <Stat
            label="Correct outcomes"
            value={rateValue(detail.accuracy.correctOutcomes, accuracyRate(detail.accuracy)?.outcome)}
          />
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

/**
 * A count, and its share ONLY where there was something to divide by.
 *
 * `accuracyRate` returns null on a zero denominator, so `rate` is undefined
 * exactly when a percentage would have been invented. "0% exact" against a
 * player who has predicted nothing is an accusation, not a statistic.
 */
function rateValue(count: number, rate: number | undefined): string {
  return rate === undefined ? formatNumber(count) : `${formatNumber(count)} (${formatShare(rate)})`
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
}: {
  readonly panel: RankHistoryPanel
  readonly onRetry?: (() => void) | undefined
}) {
  switch (panel.kind) {
    case 'unavailable':
      return <Unavailable what="this player's positions" onRetry={onRetry} />
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
}: {
  readonly panel: RivalryPanel
  readonly onRetry?: (() => void) | undefined
}) {
  switch (panel.kind) {
    case 'unavailable':
      return <Unavailable what="your comparison" onRetry={onRetry} />
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
