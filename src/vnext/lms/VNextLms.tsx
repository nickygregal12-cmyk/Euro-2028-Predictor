import { motion } from 'framer-motion'
import type { LmsPageModel, LmsRound, LmsStanding } from '../models/lms'
import { lmsChampion, lmsPickableCount, lmsRoundIsOpen } from '../models/lms'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatNumber, formatTime } from '../foundations/format'
import { LmsPickList } from './LmsPickList'
import text from '../foundations/typography.module.css'
import styles from './lms.module.css'

/**
 * vNEXT LAST MAN STANDING — ONE CONSEQUENTIAL PICK.
 *
 * ============================ IT IS NOT MATCH PREDICTOR, AND IT MUST NOT
 * LOOK LIKE IT =============================================================
 *
 * The Stage 11 predicate asks for the survival model to be "visually and
 * interactionally distinct", and the distinction is structural rather than
 * decorative:
 *
 *   • Match Predictor takes a SCORE on EVERY fixture. This page has no numeric
 *     input at all and no scoreline anywhere — a fixture appears only as the
 *     two clubs it offers;
 *   • Match Predictor rewards accuracy incrementally. This spends a club
 *     forever and can end the season, so the used list is permanent furniture
 *     rather than a detail;
 *   • Match Predictor's page is a form. This one is a CHOICE — one press, and
 *     the page's own heading is the player's standing rather than a total.
 *
 * ============================ THE STANDING IS THE HEADLINE, AND IT IS THE
 * SETTLEMENT JOB'S ========================================================
 *
 * "You are still in" is the only thing a player actually wants to know, so it
 * is the first thing on the page. It comes from `standing` and NOTHING ELSE —
 * never from what the picked club did. A club can win while its owner is out.
 *
 * ============================ THE DEADLINE IS SAID, NOT COUNTED ==========
 *
 * `locksAt` is printed as an instant. There is no countdown, because a
 * countdown is a clock the browser owns and this page does not own the
 * deadline — and no component here compares it to anything.
 */

export type LmsIntent = { readonly kind: 'pick'; readonly teamId: string }

export type VNextLmsProps = {
  readonly model: LmsPageModel
  readonly onIntent?: ((intent: LmsIntent) => void) | undefined
  /** Ask the host to read again. Offered beside a read that did not answer. */
  readonly onRetry?: (() => void) | undefined
  /** A write is in flight. Controls wait rather than queueing a second pick. */
  readonly busy?: boolean | undefined
  /** What the last submitted pick did, where it did not simply land. */
  readonly notice?: 'conflict' | 'refused' | 'failed' | undefined
}

export function VNextLms({ model, onIntent, onRetry, busy = false, notice }: VNextLmsProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { context } = model

  return (
    <VNextShell
      destination="games"
      header={
        <VNextPageHeader
          title="Last Man Standing"
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
        <StandingBanner standing={model.standing} />

        {notice === undefined ? null : <PickNotice notice={notice} />}

        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          <Body
            model={model}
            onIntent={onIntent}
            onRetry={onRetry}
            busy={busy}
          />
        </motion.div>

        {model.usedClubNames.length === 0 ? null : (
          <section className={styles.used} data-vnext-zone="used">
            <h2 className={`${text.micro} ${styles.usedHeading}`}>
              Clubs you have already used
            </h2>
            {/* PERMANENT FURNITURE, NOT A DETAIL. What a player has spent is
                half the game, and it is the thing they forget between rounds. */}
            <p className={`${text.body} ${styles.usedList}`}>
              {model.usedClubNames.join(' · ')}
            </p>
          </section>
        )}
      </div>
    </VNextShell>
  )
}

/**
 * WHERE THE PLAYER STANDS, IN ONE SENTENCE, AT THE TOP.
 *
 * The words are per standing and there is no default: an unrecognised value
 * would be a contract this build does not know, and saying "you are still in"
 * to somebody who is out is the worst sentence this page could produce.
 */
const STANDING_COPY: Record<LmsStanding, string> = {
  active: 'You are still in.',
  qualified: 'You are still in.',
  survived: 'You survived the last round.',
  eliminated: 'You have been eliminated.',
  champion: 'You are the last one standing.',
}

function StandingBanner({ standing }: { readonly standing: LmsStanding | null }) {
  if (standing === null) return null

  return (
    <p
      className={`${text.title} ${styles.standing}`}
      data-vnext-zone="standing"
      data-standing={standing}
    >
      {/* A WORD, NOT A COLOUR. §31, and it is the whole page's headline. */}
      {STANDING_COPY[standing]}
      {lmsChampion(standing) ? <span className={styles.trophy} aria-hidden="true"> 🏆</span> : null}
    </p>
  )
}

/**
 * WHAT THE LAST SUBMITTED PICK DID, WHERE IT DID NOT LAND.
 *
 * Three different sentences, because they are three different situations and
 * only one of them is answered by pressing again. A conflict and a refusal have
 * already triggered a re-read, so the page beneath this notice is the fresh
 * one — which is why neither offers a button.
 */
function PickNotice({ notice }: { readonly notice: 'conflict' | 'refused' | 'failed' }) {
  const copy =
    notice === 'conflict'
      ? 'Your pick was changed somewhere else, so we have reloaded this round. Check it still says what you want.'
      : notice === 'refused'
        ? 'The server would not take that pick — the round or the club moved while this page was open. It has been reloaded.'
        : 'We could not save that pick. Nothing has changed, so you can try again.'

  return (
    <p className={`${text.body} ${styles.notice}`} role="status" data-notice={notice}>
      {copy}
    </p>
  )
}

function Body({
  model,
  onIntent,
  onRetry,
  busy,
}: {
  readonly model: LmsPageModel
  readonly onIntent?: ((intent: LmsIntent) => void) | undefined
  readonly onRetry?: (() => void) | undefined
  readonly busy: boolean
}) {
  const body = model.body

  if (body.kind === 'unavailable') {
    return (
      <div className={styles.unavailable}>
        <p className={text.body} role="status">
          We could not load this round just now.
        </p>
        {onRetry ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    )
  }

  if (body.kind === 'not-offered') {
    /* ABOUT THE COMPETITION. Not "no round yet" — this season does not run the
     * game at all, and telling somebody to come back would be a lie. */
    return (
      <p className={`${text.body} ${styles.empty}`}>
        This competition season does not run Last Man Standing.
      </p>
    )
  }

  if (body.kind === 'not-entered') {
    /* ABOUT THE PLAYER, and it is an ordinary answer: the game is opt-in. No
     * join button, because Stage 11 does not own entry — a control here would
     * be a door onto a corridor that has not been built. */
    return (
      <p className={`${text.body} ${styles.empty}`}>
        You are not entered in Last Man Standing for this season.
      </p>
    )
  }

  if (body.kind === 'no-round') {
    return (
      <p className={`${text.body} ${styles.empty}`}>
        There is no round to play right now.
      </p>
    )
  }

  return (
    <RoundBody round={body.round} pickName={body.pick?.clubName ?? null} onIntent={onIntent} busy={busy} />
  )
}

/**
 * WHEN PICKS CLOSE, OR CLOSED, OR OPEN — THREE STATES AND THREE SENTENCES.
 *
 * SAID, NOT COUNTED. There is no countdown: the browser does not own this
 * deadline and a ticking number implies it does.
 *
 * AND "NOT OPEN YET" IS NOT "CLOSED". An earlier version had two branches —
 * open, or else closed — so a round that had not started announced "Picks
 * closed 11:00", telling a player they had missed a deadline that has not
 * arrived. `e2e/vnext-lms.spec.ts` caught it; no unit test could, because the
 * markup was perfectly well-formed and merely untrue.
 */
function Deadline({ round }: { readonly round: LmsRound }) {
  // NO DEADLINE IS THE HEADLINE, whatever else is true. An unscheduled window
  // that announced "Picks open 12:00" would imply picking becomes possible; the
  // fact a player needs is that no closing time exists yet.
  const words =
    round.locksAt === null
      ? 'No deadline set yet'
      : round.state === 'not-open'
        ? round.opensAt === null
          ? 'This round has not opened yet'
          : `Picks open ${formatTime(round.opensAt)}`
        : round.state === 'open'
          ? `Picks close ${formatTime(round.locksAt)}`
          : `Picks closed ${formatTime(round.locksAt)}`

  return <p className={`${text.micro} ${styles.deadline}`}>{words}</p>
}

/**
 * HOW MANY CLUBS ARE LEFT, AND IT MATTERS MOST WHEN IT IS ONE.
 *
 * A separate component only so the singular is impossible to get wrong: "1
 * clubs still available" is the sentence a player reads in the round where the
 * count is the whole warning.
 */
function Remaining({ count }: { readonly count: number }) {
  return (
    <p className={`${text.micro} ${styles.remaining}`}>
      {count === 0
        ? 'No clubs left for you to pick in this round'
        : `${formatNumber(count)} ${count === 1 ? 'club' : 'clubs'} still available to you`}
    </p>
  )
}

function RoundBody({
  round,
  pickName,
  onIntent,
  busy,
}: {
  readonly round: LmsRound
  readonly pickName: string | null
  readonly onIntent?: ((intent: LmsIntent) => void) | undefined
  readonly busy: boolean
}) {
  const open = lmsRoundIsOpen(round)

  return (
    <section className={styles.round} data-vnext-zone="round" data-state={round.state}>
      <div className={styles.roundHead}>
        <h2 className={`${text.title} ${styles.roundLabel}`}>{round.label}</h2>
        <Deadline round={round} />
      </div>

      {pickName === null ? (
        open ? (
          <p className={`${text.body} ${styles.prompt}`}>
            {/* THE WHOLE GAME, IN ONE LINE. */}
            Pick one club to win. You cannot use it again.
          </p>
        ) : null
      ) : (
        <p className={`${text.body} ${styles.prompt}`} data-vnext-zone="your-pick">
          You picked <strong>{pickName}</strong>.
        </p>
      )}

      <LmsPickList
        choices={round.choices}
        onPick={
          onIntent && open ? (teamId) => onIntent({ kind: 'pick', teamId }) : undefined
        }
        busy={busy}
      />

      {open ? (
        <Remaining count={lmsPickableCount(round)} />
      ) : null}
    </section>
  )
}
