import { motion } from 'framer-motion'
import type {
  BracketPanel,
  BracketSeat,
  BracketSide,
  ChampionshipOutcome,
  ChampionshipPageModel,
  ChampionshipStanding,
  TieDecision,
  TieOutcome,
} from '../models/championship'
import type { GroupPanel, GroupTable, PenaltyNumberPanel } from '../models/championship'
import { bracketRounds, penaltyLaneRule, penaltyValueAllowed } from '../models/championship'
import { useState } from 'react'
import { formatKickoffLabel } from '../foundations/format'
import { useVNextPresentationZone } from '../foundations/presentationZone'
import { VNextTrophyIcon } from '../foundations/VNextIcon'
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

export type ChampionshipIntent = {
  readonly kind: 'submit-penalty-number'
  readonly value: number
}

export type VNextChampionshipProps = {
  readonly model: ChampionshipPageModel
  /** Ask the host to read again. Offered beside a read that did not answer. */
  readonly onRetry?: (() => void) | undefined
  /** A re-read is in flight over a page that is still shown. */
  readonly refreshing?: boolean | undefined
  readonly onIntent?: ((intent: ChampionshipIntent) => void) | undefined
  /** A write is in flight. The control waits rather than queueing a second. */
  readonly busy?: boolean | undefined
  /** What the last submission did, where it did not simply land. */
  readonly notice?: string | undefined
}

export function VNextChampionship({
  model,
  onRetry,
  refreshing = false,
  onIntent,
  busy = false,
  notice,
}: VNextChampionshipProps) {
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
        <Standing standing={model.standing} seededIntoKnockout={model.seededIntoKnockout} />

        <PenaltyNumber
          panel={model.penaltyNumber}
          generatedAt={model.generatedAt}
          onIntent={onIntent}
          busy={busy}
          notice={notice}
        />

        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          <Bracket panel={model.bracket} onRetry={onRetry} refreshing={refreshing} />
          <Groups panel={model.groups} />
        </motion.div>
      </div>
    </VNextShell>
  )
}

/**
 * WHERE THE PLAYER STANDS — THE COMPETITION'S OWN VERDICT.
 *
 * Contract 208 put `bonus_competition_entrants.outcome` on the read, so this is
 * a sentence per stored value and no inference at all. For four stages there
 * was no such value and this block rendered nothing; `not-stated` STILL renders
 * nothing, and now means the database is behind contract 208 rather than that
 * the fact exists nowhere.
 *
 * `survived` HAS COPY EVEN THOUGH THE CHAMPIONSHIP DOES NOT WRITE IT. The
 * column is shared with Last Man Standing, and the constraint — not this page's
 * expectations — decides what can arrive. A record keyed on four of five values
 * throws on the fifth, which is a crash where a sentence belongs.
 */
const STANDING_COPY: Record<ChampionshipOutcome, string> = {
  active: 'You are still in.',
  qualified: 'You have qualified.',
  survived: 'You are still in.',
  eliminated: 'You have been eliminated.',
  champion: 'You won the Championship.',
}

function Standing({
  standing,
  seededIntoKnockout,
}: {
  readonly standing: ChampionshipStanding
  readonly seededIntoKnockout: boolean
}) {
  if (standing.kind !== 'stated' && !seededIntoKnockout) return null
  return (
    <div className={styles.standingBlock} data-vnext-zone="standing">
      {standing.kind === 'stated' ? (
        <p
          className={`${text.title} ${styles.standing}`}
          data-standing={standing.outcome}
        >
          {/* A WORD, NOT A COLOUR. §31. */}
          {STANDING_COPY[standing.outcome]}
          {standing.outcome === 'champion' ? (
            <VNextTrophyIcon className={styles.trophy} />
          ) : null}
        </p>
      ) : null}
      {/* THE DRAW FACT, BENEATH THE VERDICT AND NEVER INSTEAD OF IT.
          `you_qualified` is `exists(member.seed is not null)`: permanently true
          from the moment a seed is dealt, and it never becomes false when the
          player is knocked out. Rendered in the verdict slot it read as a
          CURRENT status, so a player eliminated in round one saw it above the
          very seat recording their defeat. It is true and it is not a standing,
          so it is said quietly and in the past tense. */}
      {seededIntoKnockout ? (
        <p className={`${text.micro} ${styles.standingNote}`} data-vnext-zone="seeded">
          You were seeded into the knockout draw.
        </p>
      ) : null}
    </div>
  )
}

/**
 * THE PENALTY NUMBER — the one secret in the Championship, and the one thing
 * this page asks a reader to do.
 *
 * ============================ IT STATES THE RULE BEFORE THE REFUSAL =======
 *
 * The lane is the server's — the home side (better seed) holds ODD — and
 * `submit_cup_penalty_number` refuses the wrong parity with `check_violation`.
 * That refusal is knowable in advance, so the rule is printed BESIDE the box
 * and the control refuses to submit a value that breaks it. A constraint learnt
 * from an error is a constraint the page could have told you.
 *
 * `championshipRefusal.ts` deliberately does NOT name the lane in its sentence,
 * because one SQLSTATE covers three rules there. This is the other half of that
 * split: the page says more, because the page knows more.
 *
 * ============================ THERE IS NOWHERE TO SHOW THE OPPONENT'S =====
 *
 * Not hidden, not blanked — ABSENT. The model has no field for the opponent's
 * value or for whether they have submitted, because contract 193 returns
 * neither under any condition. A page cannot leak what it has nowhere to put.
 *
 * ============================ UNSCHEDULED IS NOT CLOSED ==================
 *
 * Contract 193 returns `locked` and `open` as two independent booleans, and a
 * round whose real fixtures have no kickoff returns both false. That gets its
 * own sentence rather than being folded into "closed", because a player whose
 * round has not been scheduled has not missed anything.
 */
function PenaltyNumber({
  panel,
  generatedAt,
  onIntent,
  busy,
  notice,
}: {
  readonly panel: PenaltyNumberPanel
  readonly generatedAt: string
  readonly onIntent?: ((intent: ChampionshipIntent) => void) | undefined
  readonly busy: boolean
  readonly notice?: string | undefined
}) {
  // THE REFUSAL SURVIVES THE PANEL CHANGING UNDER IT. This is not a detail of
  // the form: the commonest refusal is `55000`, the round having locked at its
  // first kickoff, and the hook RE-READS on refusal — so by the time the
  // sentence would be shown the panel has flipped from `open` to `locked` and
  // the branch that renders it is no longer the branch running. Rendered only
  // inside the form, the one explanation the reader most needs disappeared
  // exactly when it was earned.
  const noticeLine =
    notice === undefined ? null : (
      <p className={`${text.body} ${styles.penaltyNotice}`} role="status">
        {notice}
      </p>
    )

  if (panel.kind === 'not-required') {
    if (noticeLine === null) return null
    return (
      <section className={styles.penalty} data-vnext-zone="penalty-number">
        <h2 className={`${text.micro} ${styles.penaltyHeading}`}>Penalty Number</h2>
        {noticeLine}
      </section>
    )
  }

  if (panel.kind === 'unscheduled') {
    return (
      <section className={styles.penalty} data-vnext-zone="penalty-number">
        <h2 className={`${text.micro} ${styles.penaltyHeading}`}>Penalty Number</h2>
        <p className={`${text.body} ${styles.penaltyBody}`}>
          {/* NOT "closed" — nothing has been missed. */}
          This round has no kick-off time yet, so it cannot take a Penalty
          Number.
        </p>
        {noticeLine}
      </section>
    )
  }

  if (panel.kind === 'locked') {
    return (
      <section className={styles.penalty} data-vnext-zone="penalty-number">
        <h2 className={`${text.micro} ${styles.penaltyHeading}`}>Penalty Number</h2>
        <p className={`${text.body} ${styles.penaltyBody}`}>
          {panel.value === null
            ? 'Penalty Numbers are locked for this round, and you did not submit one.'
            : `Penalty Numbers are locked. Yours was ${panel.value}.`}
        </p>
        {noticeLine}
      </section>
    )
  }

  return (
    <PenaltyNumberForm
      panel={panel}
      generatedAt={generatedAt}
      onIntent={onIntent}
      busy={busy}
      notice={notice}
    />
  )
}

function PenaltyNumberForm({
  panel,
  generatedAt,
  onIntent,
  busy,
  notice,
}: {
  readonly panel: Extract<PenaltyNumberPanel, { kind: 'open' | 'submitted' }>
  readonly generatedAt: string
  readonly onIntent?: ((intent: ChampionshipIntent) => void) | undefined
  readonly busy: boolean
  readonly notice?: string | undefined
}) {
  const zone = useVNextPresentationZone()
  const [entry, setEntry] = useState('')
  const parsed = entry.trim() === '' ? null : Number(entry)
  const allowed = parsed !== null && penaltyValueAllowed(panel.lane, parsed)

  return (
    <section className={styles.penalty} data-vnext-zone="penalty-number">
      <h2 className={`${text.micro} ${styles.penaltyHeading}`}>Penalty Number</h2>

      {panel.kind === 'submitted' ? (
        <p className={`${text.body} ${styles.penaltyBody}`} data-vnext-zone="penalty-value">
          Your Penalty Number is <strong>{panel.value}</strong>. You can change
          it until Penalty Numbers lock.
        </p>
      ) : (
        <p className={`${text.body} ${styles.penaltyBody}`}>
          A drawn tie is decided by Penalty Number. Yours is a sealed bid — no
          one else can see it.
        </p>
      )}

      {/* THE RULE, BEFORE THE REFUSAL — and the SAME element the input points at,
          rather than a second copy of the sentence hidden beside it. A screen
          reader heard it twice: once as content, once as the field description. */}
      <p
        id="vnext-penalty-rule"
        className={`${text.micro} ${styles.penaltyRule}`}
        data-vnext-zone="penalty-rule"
      >
        {penaltyLaneRule(panel.lane)}
      </p>

      {panel.locksAt === null ? null : (
        <p className={`${text.micro} ${styles.penaltyRule}`}>
          Locks {formatKickoffLabel(panel.locksAt, generatedAt, zone)}.
        </p>
      )}

      <form
        className={styles.penaltyForm}
        onSubmit={(event) => {
          event.preventDefault()
          if (!allowed || parsed === null || busy) return
          onIntent?.({ kind: 'submit-penalty-number', value: parsed })
        }}
      >
        <label className={styles.penaltyField}>
          <span className={text.srOnly}>Your Penalty Number</span>
          <input
            className={styles.penaltyInput}
            inputMode="numeric"
            // DIGITS, AND ONLY DIGITS. `Number('0x11')` is 17 and `Number('1e1')`
            // is 10, so an unfiltered field submits a sealed bid the reader did
            // not type — into a tie they cannot resubmit after it locks. Same
            // treatment as `ScoreEntry`, for the same reason.
            pattern="[0-9]*"
            maxLength={2}
            value={entry}
            onChange={(event) => setEntry(event.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
            disabled={busy}
            aria-invalid={entry.trim() === '' ? undefined : !allowed}
            aria-describedby={
              allowed || entry.trim() === ''
                ? 'vnext-penalty-rule'
                : 'vnext-penalty-rule vnext-penalty-error'
            }
          />
        </label>
        <button type="submit" className={styles.penaltySubmit} disabled={!allowed || busy}>
          {panel.kind === 'submitted' ? 'Change it' : 'Submit'}
        </button>
      </form>

      {/* THE REFUSAL, IDENTIFIED. A disabled button says a value is not
          submittable; it does not say WHY, and the rule above is phrased as an
          instruction rather than an error. */}
      {entry.trim() === '' || allowed ? null : (
        <p
          id="vnext-penalty-error"
          className={`${text.micro} ${styles.penaltyError}`}
          data-vnext-zone="penalty-error"
        >
          {penaltyLaneRule(panel.lane)}
        </p>
      )}

      {notice === undefined ? null : (
        <p className={`${text.body} ${styles.penaltyNotice}`} role="status">
          {notice}
        </p>
      )}
    </section>
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

/* ==========================================================================
   THE GROUP PHASE
   ========================================================================== */

/**
 * THE GROUP TABLES, PRINTED AS THE STANDINGS AUTHORITY SENT THEM.
 *
 * A REAL TABLE, NOT A SENTENCE. The Championship spends most of its life in
 * this phase, and for a while this page answered it with "the knockout draw has
 * not been made yet" — true, and the whole of what it said, while contract 167
 * held the standings that phase is actually about.
 *
 * IT SORTS NOTHING. `rank` is printed in the position the server sent it, and
 * the columns are its numbers. A surface that re-ordered would be a second
 * authority on a table that already has one, and the two would drift on exactly
 * the tie-breaks that decide who qualifies.
 *
 * IT IS A `<table>`, because it is one. Rank, name and five measures per row is
 * tabular data, and a screen reader navigating it by column needs the headers
 * a grid of `<div>`s cannot give it.
 *
 * `unavailable` RENDERS NOTHING. Contract 167 failing is not a fact about the
 * competition, and the bracket beside it answered on its own — which is why the
 * two reads have separate outcomes.
 */
function Groups({ panel }: { readonly panel: GroupPanel }) {
  if (panel.kind === 'unavailable' || panel.kind === 'no-groups') return null

  if (panel.kind === 'not-entered') {
    return (
      <p className={`${text.body} ${styles.empty}`} data-vnext-zone="groups-not-entered">
        You are not in this Championship&rsquo;s group stage.
      </p>
    )
  }

  return (
    <section className={styles.groups} data-vnext-zone="groups">
      <h2 className={`${text.title} ${styles.groupsHeading}`}>Group stage</h2>
      {panel.yourOrdinal === null ? (
        <p className={`${text.micro} ${styles.groupsNote}`} data-vnext-zone="groups-none-yours">
          You do not hold a group in this stage.
        </p>
      ) : null}
      {panel.groups.map((group) => (
        <GroupTableView key={group.groupId} group={group} />
      ))}
    </section>
  )
}

function GroupTableView({ group }: { readonly group: GroupTable }) {
  const caption = `Group ${group.ordinal}`
  return (
    // THE SCROLLING BOX IS FOCUSABLE, and that is not decoration. `overflow-x`
    // makes this a scrollable region; a region a mouse can scroll and a
    // keyboard cannot is content a keyboard user simply cannot reach — the
    // right-hand columns of every group table, on every phone. `tabindex="0"`
    // gives them the arrow keys, `role="region"` plus a name tells a screen
    // reader what they have landed in, and `championship.module.css` gives it
    // a focus ring so sighted keyboard users can see where they are.
    <div
      className={styles.group}
      data-vnext-group={group.ordinal}
      data-yours={group.isYours}
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className={styles.table}>
        <caption className={`${text.micro} ${styles.caption}`}>
          {caption}
          {/* THE SERVER'S FLAG, not a name compared here. */}
          {group.isYours ? <span className={styles.yoursTag}> · your group</span> : null}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.numeric}>
              #
            </th>
            <th scope="col">Player</th>
            <th scope="col" className={styles.numeric}>
              Pts
            </th>
            <th scope="col" className={styles.numeric}>
              For
            </th>
            <th scope="col" className={styles.numeric}>
              Ag
            </th>
            <th scope="col" className={styles.numeric}>
              Exact
            </th>
            <th scope="col" className={styles.numeric}>
              Correct
            </th>
            <th scope="col" className={styles.numeric}>
              Error
            </th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr key={row.userId} data-you={row.isYou || undefined}>
              <td className={styles.numeric}>{row.rank}</td>
              <th scope="row" className={styles.player}>
                {row.displayName}
                {row.isYou ? <span className={styles.you}> (you)</span> : null}
              </th>
              <td className={styles.numeric}>{row.tablePoints}</td>
              <td className={styles.numeric}>{row.pointsFor}</td>
              <td className={styles.numeric}>{row.pointsAgainst}</td>
              <td className={styles.numeric}>{row.exacts}</td>
              <td className={styles.numeric}>{row.corrects}</td>
              {/* NO SETTLED PREDICTION IS NOT AN ERROR OF ZERO. An em dash says
                  there is no number rather than inventing one. */}
              <td className={styles.numeric}>{row.scorelineError ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
