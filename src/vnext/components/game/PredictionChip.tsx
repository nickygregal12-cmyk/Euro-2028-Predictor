import type { UserPrediction } from '../../models/football'
import { formatScoreline } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import styles from './PredictionChip.module.css'

export type PredictionChipProps = {
  prediction: UserPrediction | null
}

/**
 * What the user said, and what it is worth.
 *
 * Two rules this component exists to hold:
 *
 * PROVISIONAL POINTS ARE LABELLED AS PROVISIONAL. A figure that is only true
 * while a scoreline holds is written as "on the pitch", never as a total. The
 * backend awards points; this chip is not allowed to imply otherwise.
 *
 * OUTCOME IS A WORD BEFORE IT IS A COLOUR. "Exact", "Result", "Missed" and
 * "Not predicted" are all written out, so the state survives greyscale, a
 * colour-vision difference and a screenshot.
 */
export function PredictionChip({ prediction }: PredictionChipProps) {
  if (prediction === null) {
    return (
      <span className={`${styles.chip} ${styles.absent}`}>
        <span className={styles.label}>Not predicted</span>
      </span>
    )
  }

  const { score, outcome, points, pointsAreProvisional, isJoker } = prediction
  const tone = outcome ?? (pointsAreProvisional ? 'provisional' : 'pending')

  return (
    <span className={`${styles.chip} ${styles[tone]}`}>
      <span className={styles.label}>{describe(prediction)}</span>
      <span className={`${styles.score} ${typography.numeric}`}>
        {formatScoreline(score.home, score.away)}
      </span>
      {isJoker ? (
        <span className={styles.joker}>
          {/* The hidden half starts with a comma, not a space: adjacent text is
              announced with no separator, so a leading space is simply lost. */}
          Joker<span className={typography.srOnly}>, played on this match</span>
        </span>
      ) : null}
      {points === null ? null : (
        <span className={`${styles.points} ${typography.numeric}`}>
          {points} pts
          {pointsAreProvisional ? (
            <span className={styles.provisionalNote}> on the pitch</span>
          ) : null}
        </span>
      )}
    </span>
  )
}

function describe(prediction: UserPrediction): string {
  if (prediction.outcome === 'exact') return 'Exact score'
  if (prediction.outcome === 'result') return 'Right result'
  if (prediction.outcome === 'missed') return 'Missed'
  if (prediction.status === 'draft') return 'Draft'
  return 'Your call'
}
