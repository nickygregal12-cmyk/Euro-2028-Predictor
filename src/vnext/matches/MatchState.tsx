import { motion } from 'framer-motion'
import type { MatchScoreClaim, MatchState } from '../models/matches'
import { matchScoreClaim } from '../models/matches'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatScoreline } from '../foundations/format'
import text from '../foundations/typography.module.css'
import styles from './matches.module.css'

/**
 * THE STATE OF A MATCH, AS ONE MARK — and the file the live-data rule is
 * enforced in.
 *
 * IT RECEIVES A `MatchState` AND READS NOTHING ELSE. No kickoff instant is
 * compared with anything, no `Date.now()` is called, and there is no path from
 * this component to a clock. If the model says live with no minute, the mark
 * says "Live" and stops — because the alternative is inventing 72' from the
 * fact that kickoff was 72 minutes ago, which is the single defect this whole
 * stage is arranged to make impossible.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. Every state carries a WORD. A red dot with
 * no "Live" beside it fails §31 and fails anyone reading in greyscale; the
 * pulse is emphasis on top of a word that is always there.
 */
export function MatchStateMark({ state }: { readonly state: MatchState }) {
  const pulse = useVNextMotion(vnextMotion.livePulse)

  switch (state.kind) {
    case 'live':
      return (
        // `aria-live="off"`: a score that changes every few seconds must not
        // interrupt whatever a screen-reader user is actually doing. The row's
        // own accessible summary carries the state.
        <span className={`${styles.mark} ${styles.markLive}`} aria-live="off">
          <motion.span
            className={styles.liveDot}
            variants={pulse}
            animate="rest"
            aria-hidden="true"
          />
          <span className={styles.markWord}>{state.observation.phaseLabel}</span>
          {/* ONLY WHERE THE PROVIDER SUPPLIED ONE. */}
          {state.observation.clock ? (
            <span className={`${styles.markClock} ${text.numeric}`}>
              {state.observation.clock.label}
            </span>
          ) : null}
        </span>
      )

    case 'awaitingResult':
      return (
        <span className={`${styles.mark} ${styles.markAwaiting}`}>
          <span className={styles.markWord}>{state.observation.phaseLabel}</span>
          <span className={styles.markNote}>Not yet confirmed</span>
        </span>
      )

    case 'finished':
      return (
        <span className={`${styles.mark} ${styles.markFinished}`}>
          <span className={styles.markWord}>Full time</span>
          {state.decision === null ? null : (
            <span className={styles.markNote}>
              {state.decision.kind === 'afterExtraTime'
                ? 'after extra time'
                : `won ${state.decision.shootout.home}–${state.decision.shootout.away} on penalties`}
            </span>
          )}
        </span>
      )

    case 'postponed':
      return (
        <span className={`${styles.mark} ${styles.markOff}`}>
          <span className={styles.markWord}>Postponed</span>
        </span>
      )

    case 'abandoned':
      return (
        <span className={`${styles.mark} ${styles.markOff}`}>
          <span className={styles.markWord}>Abandoned</span>
        </span>
      )

    case 'void':
      return (
        <span className={`${styles.mark} ${styles.markOff}`}>
          <span className={styles.markWord}>Void</span>
        </span>
      )

    default:
      // Scheduled. The kickoff TIME is the mark, and the row draws it in the
      // score column — there is no chip that says "scheduled", because a time
      // already says it and a second label would be noise on every quiet day.
      return null
  }
}

/**
 * THE SCORE, AND WHAT KIND OF CLAIM IT IS.
 *
 * ONE COMPONENT FOR BOTH BASES, so the provisional/official distinction is a
 * property of the mark rather than something each caller remembers. A
 * provisional score is visibly different AND says the word — "provisional" is
 * in the accessible name, not only in a colour — because the ingestion boundary
 * exists exactly so that nobody reads a feed's number as a result.
 */
export function MatchScoreMark({
  state,
  kickoffLabel,
  size = 'row',
}: {
  readonly state: MatchState
  readonly kickoffLabel: string | null
  readonly size?: 'row' | 'hero'
}) {
  const claim: MatchScoreClaim | null = matchScoreClaim(state)

  if (claim === null) {
    // No score to show. A scheduled match shows its kickoff; a postponed one
    // shows a dash, because "15:00" beside "Postponed" reads as a match that is
    // about to start.
    const showKickoff = state.kind === 'scheduled' || state.kind === 'live'
    return (
      <span
        className={`${size === 'hero' ? styles.heroScore : styles.score} ${text.numeric} ${
          styles.scoreEmpty
        }`}
      >
        {showKickoff && kickoffLabel ? kickoffLabel : showKickoff ? 'TBC' : '—'}
      </span>
    )
  }

  return (
    <span
      className={`${size === 'hero' ? styles.heroScore : styles.score} ${text.numeric} ${
        claim.basis === 'provisional' ? styles.scoreProvisional : styles.scoreOfficial
      }`}
    >
      <span aria-hidden="true">{formatScoreline(claim.score.home, claim.score.away)}</span>
      {/* The visible glyph is a scoreline; what assistive technology gets is a
          sentence, and it names the basis. */}
      <span className={text.srOnly}>
        {claim.basis === 'provisional'
          ? `${claim.score.home} to ${claim.score.away}, provisional score`
          : `${claim.score.home} to ${claim.score.away}`}
      </span>
    </span>
  )
}
