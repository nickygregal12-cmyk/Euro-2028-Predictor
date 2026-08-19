import { motion } from 'framer-motion'
import type {
  BracketPanel,
  BracketSeat,
  BracketSide,
  ChampionshipPageModel,
  ChampionshipStanding,
  TieDecision,
  TieOutcome,
} from '../models/championship'
import { bracketRounds } from '../models/championship'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './championship.module.css'

/**
 * vNEXT PREDICTOR CHAMPIONSHIP — where am I, and how can I win it.
 *
 * ============================ THE BRACKET IS A LAYOUT PROBLEM, NOT A
 * DRAWING ONE ============================================================
 *
 * The predicate asks that the "bracket layout works on phone and desktop
 * without becoming unreadable", and the honest reading is that a knockout TREE
 * does not work on a phone. Sixteen seats across four columns at 375px is four
 * columns nobody can read, plus connector lines that cost more than they
 * explain.
 *
 * So this is not a scaled tree. It is **rounds as sections**, and the container
 * query changes how many sit side by side rather than how small they are:
 *
 *   compact  (< 700px)   one round per row, in the server's order. A player
 *                        reads DOWN the competition.
 *   regular  (>= 700px)  two rounds across.
 *   expanded (>= 1180px) rounds run as columns — the shape a bracket is
 *                        usually drawn in, reached by WIDENING rather than by
 *                        shrinking.
 *
 * NO CONNECTOR LINES, AT ANY WIDTH. A line between two seats asserts which one
 * feeds which, and that is a claim about progression this lane cannot make:
 * contract 193 gives `bracket_slot` per seat and NO EDGE between them. Drawing
 * one would be reconstructing the bracket, which is the exact thing the
 * headline predicate forbids. The round headings carry the same information
 * without inventing the topology.
 *
 * ============================ AN EMPTY SEAT SAYS SO ======================
 *
 * "To be decided", never a name — contract 193 renders an unfilled seat with
 * the display name `'Player'`, so a surface that trusted the name would show a
 * person standing in every hole in the draw.
 *
 * ============================ AND NO SCORE APPEARS ANYWHERE ==============
 *
 * A settled tie is a WORD — "Decided on points", "Walkover" — because a word is
 * all the settlement authority stated. There is no scoreline in this file, and
 * no reason for a walkover either: `game_memberships.status` is not in this
 * read, so "withdrew" and "was disqualified" are indistinguishable here and
 * neither may be printed.
 */

export type VNextChampionshipProps = {
  readonly model: ChampionshipPageModel
  /** Ask the host to read again. Offered beside a read that did not answer. */
  readonly onRetry?: (() => void) | undefined
  /** A re-read is in flight over a page that is still shown. */
  readonly refreshing?: boolean | undefined
}

export function VNextChampionship({ model, onRetry, refreshing = false }: VNextChampionshipProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { context } = model

  return (
    <VNextShell
      destination="games"
      header={
        <VNextPageHeader
          title="Predictor Championship"
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
        <Standing standing={model.standing} />

        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          <Bracket panel={model.bracket} onRetry={onRetry} refreshing={refreshing} />
        </motion.div>
      </div>
    </VNextShell>
  )
}

/**
 * WHERE THE PLAYER STANDS — WHERE AN AUTHORITY SAID SO.
 *
 * `not-stated` RENDERS NOTHING AT ALL, and that is the deliverable rather than
 * an omission. No season Championship read supplies elimination, so a banner
 * here could only be a guess — and it is the guess a reader would most readily
 * believe, because it would sit exactly where a real verdict goes. Silence is
 * the truthful output, and the gap is recorded rather than papered over.
 */
const STANDING_COPY: Record<'active' | 'qualified' | 'eliminated' | 'champion', string> = {
  active: 'You are still in.',
  qualified: 'You qualified for the knockout.',
  eliminated: 'You have been eliminated.',
  champion: 'You won the Championship.',
}

function Standing({ standing }: { readonly standing: ChampionshipStanding }) {
  if (standing.kind !== 'stated') return null
  return (
    <p
      className={`${text.title} ${styles.standing}`}
      data-vnext-zone="standing"
      data-standing={standing.outcome}
    >
      {/* A WORD, NOT A COLOUR. §31. */}
      {STANDING_COPY[standing.outcome]}
      {standing.outcome === 'champion' ? (
        <span className={styles.trophy} aria-hidden="true"> 🏆</span>
      ) : null}
    </p>
  )
}

function Bracket({
  panel,
  onRetry,
  refreshing,
}: {
  readonly panel: BracketPanel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing: boolean
}) {
  if (panel.kind === 'unavailable') {
    return (
      <div className={styles.unavailable} data-vnext-zone="bracket-unavailable">
        <p className={text.body} role="status" aria-busy={refreshing}>
          {refreshing ? 'Trying again…' : 'We could not load this Championship just now.'}
        </p>
        {onRetry && !refreshing ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    )
  }

  if (panel.kind === 'not-entered') {
    /* ABOUT THE PLAYER, and an ordinary answer. No join control: Stage 12 does
     * not own entry, and a door onto a corridor nobody built is worse than
     * no door at all. */
    return (
      <p className={`${text.body} ${styles.empty}`} data-vnext-zone="not-entered">
        You are not entered in this Championship.
      </p>
    )
  }

  if (panel.kind === 'not-drawn') {
    return (
      <p className={`${text.body} ${styles.empty}`} data-vnext-zone="not-drawn">
        The knockout draw has not been made yet.
      </p>
    )
  }

  const rounds = bracketRounds(panel.seats)

  return (
    <section className={styles.bracket} data-vnext-zone="bracket">
      {panel.champion === null ? null : (
        <p className={`${text.body} ${styles.champion}`} data-vnext-zone="champion">
          <strong>{panel.champion.displayName}</strong> won the Championship.
        </p>
      )}

      <ol className={styles.rounds}>
        {rounds.map((round) => (
          <li key={round.windowSequence} className={styles.round}>
            <h2 className={`${text.micro} ${styles.roundHeading}`}>
              {/* THE SERVER'S OWN LABEL. Where it left one out, the round is
                  named by its sequence rather than by counting its seats —
                  "the round with two ties" is an inference about shape. */}
              {round.label ?? `Round ${round.windowSequence}`}
            </h2>
            <ul className={styles.seats}>
              {round.seats.map((seat) => (
                <Seat key={seat.key} seat={seat} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * ONE TIE.
 *
 * BOTH SIDES ALWAYS RENDER, including an empty one, because a half-filled seat
 * is a real state of a real bracket and hiding it would make the round look
 * smaller than it is.
 */
function Seat({ seat }: { readonly seat: BracketSeat }) {
  const settled = seat.outcome.kind === 'settled'
  return (
    <li
      className={styles.seat}
      data-vnext-zone="seat"
      data-yours={seat.isYours ? 'yes' : undefined}
      data-settled={settled ? 'yes' : undefined}
    >
      <div className={styles.sides}>
        <Side
          side={seat.home}
          won={seat.outcome.kind === 'settled' && seat.outcome.winnerIsHome === true}
        />
        <span className={`${text.micro} ${styles.versus}`} aria-hidden="true">
          v
        </span>
        <Side
          side={seat.away}
          won={seat.outcome.kind === 'settled' && seat.outcome.winnerIsHome === false}
        />
      </div>
      <Outcome outcome={seat.outcome} />
      {seat.isYours ? (
        /* A WORD, not a highlight. §31 — and the reader's own tie is the one
           thing they scan a bracket for. */
        <p className={`${text.micro} ${styles.yours}`}>Your tie</p>
      ) : null}
    </li>
  )
}

function Side({ side, won }: { readonly side: BracketSide; readonly won: boolean }) {
  if (side.kind === 'empty') {
    return (
      <span className={`${text.body} ${styles.side}`} data-side="empty">
        {/* NEVER A NAME. Contract 193 calls an unfilled seat 'Player'. */}
        To be decided
      </span>
    )
  }
  return (
    <span className={`${text.body} ${styles.side}`} data-side={won ? 'won' : 'played'}>
      {side.displayName}
      {side.isYou ? <span className={styles.youMark}> (you)</span> : null}
      {/* THE WINNER IS MARKED IN WORDS as well as in weight, so the result
          survives a monochrome screen and reaches a screen reader. */}
      {won ? <span className={text.srOnly}> — won</span> : null}
    </span>
  )
}

/**
 * HOW THE TIE WAS DECIDED, IN THE SETTLEMENT AUTHORITY'S OWN VOCABULARY.
 *
 * `walkover` and `admin_walkover` get different words because the server keeps
 * them apart: one is the competition's rule firing, the other an organiser
 * acting. Neither says WHY, and neither may grow a scoreline.
 */
const DECISION_COPY: Record<TieDecision, string> = {
  points: 'Decided on points',
  extra_time: 'Decided in extra time',
  penalty_number: 'Decided by Penalty Number',
  walkover: 'Walkover',
  admin_walkover: 'Walkover, awarded by an organiser',
}

function Outcome({ outcome }: { readonly outcome: TieOutcome }) {
  if (outcome.kind === 'unsettled') {
    return <p className={`${text.micro} ${styles.outcome}`}>Not played yet</p>
  }
  return (
    <p className={`${text.micro} ${styles.outcome}`} data-decision={outcome.decision}>
      {DECISION_COPY[outcome.decision]}
    </p>
  )
}
