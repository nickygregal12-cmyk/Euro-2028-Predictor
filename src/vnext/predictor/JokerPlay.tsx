import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import typography from '../foundations/typography.module.css'
import type { PredictorJoker } from '../models/predictor'
import styles from './predictor.module.css'

/**
 * THE JOKER, AS A GAME MECHANIC.
 *
 * WHAT IT IS NOT. The legacy card renders the Joker as a button with a
 * one-line subtitle, sitting in a row of card actions between "Confirm card" and
 * a receipt. That is a form control, and the Joker is not a preference — it is
 * the biggest single decision a player makes in a matchweek, it doubles
 * everything they are about to earn, and there are five of them per half of a
 * season. It should feel like spending something.
 *
 * SO IT IS A STAKE, AND IT SAYS WHAT IT COSTS. The unplayed state names the
 * effect ("doubles every point this matchweek") and the allowance remaining, so
 * the decision is made with both numbers visible. The played state is
 * unmistakable — its own surface treatment, its own mark, and the word "played"
 * — because a player scrolling past it must not have to wonder.
 *
 * FOUR STATES, AND THE APPLICATION DECIDES WHICH. `playable` is the allowance
 * answer and `refusal` is `commandRefusal`'s own sentence; this component asks
 * neither question. It cannot: there is no arithmetic here over
 * `remainingThisHalf`, no matchweek number, and no half boundary. ADR 0012 owns
 * the rule and the server enforces it regardless of what this draws.
 *
 * NOTHING IS DISABLED. A Joker with none left is a SENTENCE, not a greyed
 * button, for the reason the legacy page records: "a greyed Joker is the sentence
 * 'you have none left' spelled in opacity".
 *
 * THE MOTION IS THE ACTIVATION AND NOTHING ELSE. Playing a Joker gets one
 * emphasis beat on the mark; it does not pulse afterwards, because a control
 * that keeps moving is asking to be pressed again. Under reduced motion the beat
 * is removed and the state is carried by the surface, the word and the mark —
 * all three of which are still different from the unplayed state.
 */

export type JokerPlayProps = {
  joker: PredictorJoker
  /** The application's card-level editability. Never recomputed here. */
  editable: boolean
  onPlay: (played: boolean) => void
}

export function JokerPlay({ joker, editable, onPlay }: JokerPlayProps) {
  const emphasis = useVNextMotion(vnextMotion.pointsEmphasis)
  const { playedHere, remainingThisHalf, refusal } = joker

  const mark = (
    <motion.span
      className={styles.jokerMark}
      variants={emphasis}
      initial="rest"
      animate={playedHere ? 'changed' : 'rest'}
    >
      <Sparkles className={styles.jokerGlyph} aria-hidden="true" />
    </motion.span>
  )

  /**
   * A SENTENCE WHERE THE COMMAND WOULD BE REFUSED. That covers both a locked
   * matchweek and a spent allowance, and the words are the application's in each
   * case — this component does not know which of the two it is looking at, which
   * is exactly right.
   */
  if (refusal !== null || !editable) {
    return (
      <p className={styles.joker} data-played={playedHere ? '' : undefined} data-static="">
        {mark}
        <span className={styles.jokerText}>
          <span className={`${typography.caption} ${typography.emphasis}`}>
            {playedHere ? 'Joker played on this matchweek' : 'No Joker on this matchweek'}
          </span>
          {refusal === null ? null : <span className={typography.micro}>{refusal}</span>}
        </span>
      </p>
    )
  }

  return (
    <button
      type="button"
      className={styles.joker}
      data-played={playedHere ? '' : undefined}
      // `aria-pressed` rather than a checkbox: this is a toggle on a game action,
      // and the played state is the pressed state. The label changes with it too,
      // so the state is never carried by the attribute alone.
      aria-pressed={playedHere}
      onClick={() => onPlay(!playedHere)}
    >
      {mark}
      <span className={styles.jokerText}>
        <span className={`${typography.caption} ${typography.emphasis}`}>
          {playedHere ? 'Joker played — tap to take it back' : 'Play your Joker'}
        </span>
        <span className={typography.micro}>
          Doubles every point this matchweek · {remainingThisHalf} left this half
        </span>
      </span>
    </button>
  )
}
