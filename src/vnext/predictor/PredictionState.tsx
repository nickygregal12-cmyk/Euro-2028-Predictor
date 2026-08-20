import { motion } from 'framer-motion'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { Check, Lock, RotateCcw } from 'lucide-react'
import type {
  PredictorPredictionState,
  PredictorSaveState,
} from '../models/predictor'
import typography from '../foundations/typography.module.css'
import styles from './predictor.module.css'

/**
 * WHERE ONE PREDICTION STANDS, said in a word and drawn as a shape.
 *
 * The workshop's third visual principle is the rule this component exists to
 * keep: "colour means state, and never carries it alone". Every state below has
 * a colour, a WORD and a MARK, and the mark is a different shape rather than the
 * same disc in a different hue — a dashed ring for nothing entered, a half ring
 * for half entered, a tick for entered, a padlock for locked, a filled disc for
 * settled. Take the colour away and the row still reads.
 *
 * THE SAVE STATE OUTRANKS THE PREDICTION STATE, and that ordering is the
 * honesty. A player who has typed a scoreline that has not reached the server
 * must not be told "Your call" as though it were banked: `saving`, `error` and
 * `conflict` each replace the word. Only an idle or saved fixture shows what the
 * prediction IS, because only then is what is on screen what the server holds.
 *
 * A CONFLICT OFFERS NO RETRY. `useSeasonMatchPredictor` classifies a version
 * conflict as terminal — "guessing which side wins is exactly what a conflict
 * means we cannot do" — so this says the row is stale and the page's own notice
 * offers the reload. Retrying a conflict is offering to overwrite somebody.
 */

export type PredictionStateProps = {
  state: PredictorPredictionState
  save: PredictorSaveState
  /** Offered only for a save that failed for a reason a retry could fix. */
  onRetry?: (() => void) | undefined
}

type Mark = 'empty' | 'partial' | 'entered' | 'locked' | 'settled' | 'busy' | 'alert'

const WORD: Record<PredictorPredictionState, string> = {
  empty: 'No prediction',
  partial: 'Needs both scores',
  entered: 'Your call',
  locked: 'Locked',
  settled: 'Settled',
}

const MARK: Record<PredictorPredictionState, Mark> = {
  empty: 'empty',
  partial: 'partial',
  entered: 'entered',
  locked: 'locked',
  settled: 'settled',
}

export function PredictionState({ state, save, onRetry }: PredictionStateProps) {
  const settle = useVNextMotion(vnextMotion.saveSettle)
  const saving = save === 'saving'
  const failed = save === 'error'
  const conflicted = save === 'conflict'

  const word = saving
    ? 'Saving'
    : failed
      ? 'Not saved'
      : conflicted
        ? 'Changed elsewhere'
        : WORD[state]

  const mark: Mark = saving ? 'busy' : failed || conflicted ? 'alert' : MARK[state]

  return (
    <span
      className={`${styles.predictionState} ${typography.micro}`}
      data-mark={mark}
      // One region for the whole status, announced politely, because this text
      // is the answer to "did that save" — the one thing on the row a player
      // waits for. It is `polite` rather than `assertive`: a save landing must
      // not interrupt somebody typing the next fixture.
      aria-live="polite"
    >
      <StateMark mark={mark} />
      {/* THE ROW SETTLING, ONCE, WHEN THE SERVER AGREED.
          `key` is the word rather than the save state, so the settle plays on
          every change of what the row SAYS and not on a re-render that changed
          nothing. It plays for a refusal too — "Not saved" arriving with no
          motion at all, in the same place a success just moved, is the one
          state change worth noticing that would be the quietest. */}
      <motion.span key={word} variants={settle} initial="rest" animate="landed">
        {word}
      </motion.span>
      {failed && onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          <RotateCcw className={styles.retryGlyph} aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </span>
  )
}

/**
 * The shape half of the state.
 *
 * The rings are drawn in CSS rather than fetched as icons so they inherit the
 * pill's own colour and size, and because a dashed ring and a half ring are two
 * borders rather than two assets. The padlock and the tick are lucide glyphs,
 * which the repository already ships and `VNextNav` already uses — no icon set
 * was added for this page.
 *
 * `aria-hidden` throughout: the word beside it says the same thing, and a mark
 * announced as well would say every state twice.
 */
function StateMark({ mark }: { mark: Mark }) {
  if (mark === 'locked') return <Lock className={styles.stateGlyph} aria-hidden="true" />
  if (mark === 'entered') return <Check className={styles.stateGlyph} aria-hidden="true" />
  return <span className={styles.stateRing} data-mark={mark} aria-hidden="true" />
}
