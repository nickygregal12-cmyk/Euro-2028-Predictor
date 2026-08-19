import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatCountdown, formatKickoffLabel, formatNumber } from '../foundations/format'
import { useVNextPresentationZone } from '../foundations/presentationZone'
import typography from '../foundations/typography.module.css'
import surfaces from '../foundations/surfaces.module.css'
import type { PredictorActions, PredictorModel } from '../models/predictor'
import { JokerPlay } from './JokerPlay'
import styles from './predictor.module.css'

/**
 * THE BRIEF: what matchweek this is, when it locks, how far through it the
 * player is, and what the Joker is doing.
 *
 * WHY IT IS A BRIEF AND NOT A HERO. Home's dominant zone is a cinematic
 * treatment of one moment, and copying it here would be wrong twice over: a
 * player arrives on this page to WORK, so a half-screen of atmosphere is a
 * half-screen of scrolling before the first decision; and the thing that
 * deserves emphasis is not one fixture but the player's own position across ten.
 * So this is dense, horizontal and short — the FPL half of the brief, where the
 * gameweek, the deadline and your progress are stated plainly and get out of the
 * way.
 *
 * ON A WIDE SCREEN THIS BECOMES THE RAIL and stops being a band. Same component,
 * same markup: the page's grid puts it beside the working column and the
 * stylesheet lets it stack. That is how desktop uses the space without a
 * permanent sidebar invented to fill it — every part of this answers a player
 * question, and on a phone the same parts answer them above the list.
 *
 * IT NEVER DECIDES ANYTHING. `lock.kind`, `lock.urgency`, `editable`, the
 * progress counts, the Joker's playability and the confirm command's legality
 * all arrive as stated facts. The only arithmetic here is the countdown's own
 * formatting, which takes `now` as an input and therefore reads no clock.
 */

export type MatchweekBriefProps = {
  model: PredictorModel
  actions: PredictorActions
  /**
   * The instant to draw the deadline against.
   *
   * SUPPLIED, NOT READ, and it is the page's single display instant from
   * `useDeadlineClock` — the same one the masthead's chip and every kickoff label
   * use, so the brief's "Locks tomorrow 12:00" cannot disagree with a row's
   * "Today 12:00". It advances while the page is open and it is presentation
   * only: `lock.kind` and `editable` still decide everything this component
   * draws, and neither is derived from this value here or anywhere else.
   */
  now: string
  /**
   * Take the player to the next fixture that still needs a decision. Null where
   * there is none — every fixture is entered, or the card is not editable.
   */
  onJumpToNext: (() => void) | null
}

export function MatchweekBrief({ model, actions, now, onJumpToNext }: MatchweekBriefProps) {
  const zone = useVNextPresentationZone()
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { lock, progress, phase } = model
  const remaining = progress.total - progress.entered
  const countdown = lock.at === null ? null : formatCountdown(lock.at, now)

  return (
    <motion.aside
      className={`${surfaces.raised} ${styles.brief}`}
      aria-label={`${model.matchweek.label} summary`}
      // The zone marker the browser suite measures compositions by, the same idiom
      // Home uses. It names a REGION of this page and nothing about its state.
      data-vnext-zone="brief"
      data-phase={phase}
      data-urgency={lock.urgency ?? undefined}
      // THE COMPLETION MOMENT. Entering the last prediction is the payoff of the
      // whole page, so the brief changes state when it happens rather than merely
      // filling a bar: the surface takes the accent edge, the track goes to the
      // `hit` colour and the progress line says so in words. It is a state on the
      // model's own counts, so it arrives the instant the last score lands.
      data-complete={remaining === 0 && progress.total > 0 ? '' : undefined}
      variants={rise}
      initial="hidden"
      animate="visible"
    >
      {/* THE ONE PLACE ON THIS PAGE THAT IS ALLOWED TO SHOUT.
          A deadline inside two hours is the moment the whole surface exists for,
          so it takes the display type step, the live colour and the glow — and
          nothing else on the page does. At `soon` and `calm` the same block is
          quiet at the title step. That is what reserving intensity means: the
          escalation is legible precisely because it is rare, and it is driven by
          the MODEL's urgency rather than by a comparison made here. */}
      <div className={styles.briefDeadline}>
        <p className={typography.label}>{lock.label}</p>
        <p
          className={`${
            lock.urgency === 'urgent' ? typography.display : typography.title
          } ${styles.briefHeadline}`}
        >
          {/* Three genuinely different sentences rather than one with holes in
              it. A closed matchweek is not "locks in 0 min", and a matchweek
              whose deadline could not be resolved must not be given one. */}
          {lock.kind === 'open'
            ? countdown === null
              ? 'Open for predictions'
              : countdown
            : lock.kind === 'closed'
              ? 'Locked'
              : 'Deadline unconfirmed'}
        </p>
        {/* WHEN, AS WELL AS HOW LONG. A countdown answers "have I got time" and a
            clock answers "when do I need to be back" — a player planning their
            evening wants the second, and the two together are three words. */}
        {lock.kind === 'open' && lock.at !== null ? (
          <p className={`${typography.caption} ${typography.numeric} ${styles.briefWhen}`}>
            Locks {formatKickoffLabel(lock.at, now, zone)}
          </p>
        ) : null}
        <p className={typography.caption}>{lock.detail}</p>
      </div>

      <ProgressTrack model={model} />

      <LockConsequence model={model} />

      {/* The jump is the fast path through a card and the reason it exists: on a
          phone, finding the one fixture you have not done in a list of ten is
          scrolling, and this is one tap. Absent — not disabled — when there is
          nothing outstanding, because then it is a control with nowhere to go. */}
      {onJumpToNext ? (
        <button type="button" className={`${styles.jump} ${typography.emphasis}`} onClick={onJumpToNext}>
          <ArrowDown className={styles.jumpGlyph} aria-hidden="true" />
          {remaining === 1 ? 'Go to the last fixture' : `Go to the next of ${formatNumber(remaining)}`}
        </button>
      ) : null}

      <JokerPlay joker={model.joker} editable={model.editable} onPlay={actions.setJoker} />

      <ConfirmCard model={model} actions={actions} />
    </motion.aside>
  )
}

/**
 * WHAT THE LOCK WILL DO TO THIS CARD, in words.
 *
 * THE FACT IS THE APPLICATION'S AND THE SENTENCE IS THIS LANE'S. `atLock` is
 * `CardPresentation`'s own two-valued answer; the counts are the model's own
 * progress. Nothing here decides anything — and composing the sentence rather
 * than carrying it means it cannot disagree with the counts beside it, which a
 * pre-written string does the instant a score is entered.
 *
 * THE TWO CASES ARE GENUINELY DIFFERENT AND THE COPY SAYS SO. `cardSubmission.ts`
 * keeps "never engaged" apart from "engaged and left blank" on purpose, because
 * they bank different things: an untouched matchweek banks nothing at all, and a
 * touched one banks exactly what is in it with the blanks scoring zero. A player
 * who has not started needs to be told the first thing, plainly.
 */
function LockConsequence({ model }: { model: PredictorModel }) {
  const { atLock, progress } = model
  if (atLock === null) return null

  const remaining = progress.total - progress.entered
  const sentence =
    atLock === 'unbanked'
      ? 'You have not started this matchweek. Left untouched it banks nothing and scores nothing — which is different from entering predictions and leaving some blank.'
      : remaining === 0
        ? 'Every fixture is entered. At the first kickoff this card banks all of them.'
        : `At the first kickoff this card banks the ${progress.entered} you have entered. The other ${remaining} will score zero — nothing is filled in for you.`

  return <p className={`${typography.caption} ${styles.consequence}`}>{sentence}</p>
}

/**
 * PROGRESS AS A SHAPE, ONE SEGMENT PER FIXTURE.
 *
 * A bar showing 60% answers "how far through am I" and not "how many are left",
 * and on this page the second question is the one the player is actually asking.
 * Ten segments make the remaining decisions countable at a glance, which is what
 * turns the graphic into a to-do list rather than a decoration.
 *
 * THE SEGMENTS ARE HIDDEN FROM ASSISTIVE TECHNOLOGY and the sentence beside them
 * carries the whole state, because ten announcements of "entered" is noise where
 * "6 of 10 entered" is the answer. The sentence is also what survives greyscale.
 */
function ProgressTrack({ model }: { model: PredictorModel }) {
  const { entered, total } = model.progress
  const complete = total > 0 && entered === total

  return (
    <div className={styles.progress}>
      <p className={`${typography.caption} ${styles.progressLine}`}>
        <span className={`${typography.numeric} ${typography.emphasis} ${styles.progressCount}`}>
          {entered}
          <span className={typography.muted}>/{total}</span>
        </span>
        <span>
          {total === 0
            ? 'no fixtures published'
            : complete
              ? 'predicted — card complete'
              : 'predicted'}
        </span>
      </p>

      {total === 0 ? null : (
        <span className={styles.track} data-complete={complete ? '' : undefined} aria-hidden="true">
          {model.fixtures.map((fixture) => (
            <span
              key={fixture.id}
              className={styles.segment}
              data-filled={fixture.prediction === null ? undefined : ''}
            />
          ))}
        </span>
      )}
    </div>
  )
}

/**
 * THE CARD-LEVEL CONFIRM, which is a different act from saving a prediction.
 *
 * Predictions save themselves as they are entered — that is the application's
 * real behaviour and this page does not pretend otherwise, so there is no
 * "Submit" here that would imply nothing was saved until it was pressed.
 * Confirming is a record of intent: "I have finished, and the blanks are
 * deliberate". `cardSubmission.ts` keeps that distinction on purpose, because "I
 * meant to leave that blank" and "I had not got to it yet" are different things
 * to have said.
 *
 * NOTHING HERE IS DISABLED. Where the command would be refused, the model's
 * `refusal` — which is `commandRefusal`'s own sentence — is printed instead of a
 * greyed button. That is this repository's stated position: a disabled control is
 * the refusal spelled in opacity.
 */
function ConfirmCard({ model, actions }: { model: PredictorModel; actions: PredictorActions }) {
  const { confirm } = model

  if (confirm.state === 'absent') return null

  if (confirm.state === 'confirmed') {
    return (
      <p className={`${typography.caption} ${styles.confirmState}`}>
        Card confirmed. You can still change a prediction until this matchweek locks.
      </p>
    )
  }

  if (confirm.state === 'refused') {
    return <p className={`${typography.caption} ${styles.confirmState}`}>{confirm.refusal}</p>
  }

  return (
    <button type="button" className={styles.confirm} onClick={actions.confirmCard}>
      Confirm card
    </button>
  )
}
