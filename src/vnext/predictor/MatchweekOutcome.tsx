import { motion } from 'framer-motion'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatNumber } from '../foundations/format'
import surfaces from '../foundations/surfaces.module.css'
import typography from '../foundations/typography.module.css'
import type { PredictorModel } from '../models/predictor'
import styles from './predictor.module.css'

/**
 * WHAT THE MATCHWEEK WAS WORTH, once it has settled.
 *
 * ONE TOTAL, AND IT IS THE SERVER'S. `settledPoints` is the figure the season,
 * the leagues and the standings all agree on. Nothing here adds the fixtures up
 * and shows the sum: the total on screen is the one the platform banked, or there
 * is no total on screen. That is `matchweekPointsModel`'s stated rule and it is
 * the reason this component takes no per-fixture points at all — contract 113's
 * card does not supply one, so there is nothing honest to itemise.
 *
 * THE SPLIT IS A COUNT, NOT A SCORE. Exact, right result, missed and blank come
 * from the model's `tally`, which the adapter counted from the domain rule's own
 * verdicts. `blank` is separate from `missed` on purpose: the rule awards and
 * withholds nothing for a prediction that was never made.
 *
 * THE JOKER IS A LINE, NOT A MULTIPLIER PER ROW, exactly where ADR 0012 applies
 * it — once, to the whole matchweek. Doubling each fixture would reach the same
 * number by a route the rule does not take, and would teach the player the wrong
 * rule.
 *
 * IT RENDERS NOTHING BEFORE SETTLEMENT. No projection, no "on the pitch" figure
 * and no provisional total, because the card read states none and a number
 * invented here would be a confident claim about a matchweek still being scored.
 */

export type MatchweekOutcomeProps = {
  model: PredictorModel
  /**
   * Offered ONLY where the integration layer supplied one, so the presentation
   * lane keeps its rule: this component renders a canvas for nobody and reaches
   * no service. Without the prop there is no control and nothing changes.
   *
   * It sits on the settled outcome and nowhere else, because a settled
   * matchweek is the only state on this page where there is a result to boast
   * about. A share control beside an open card would be an invitation to
   * publish a prediction before its lock.
   */
  onShare?: (() => void) | undefined
}

export function MatchweekOutcome({ model, onShare }: MatchweekOutcomeProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { settledPoints, tally } = model

  if (settledPoints === null) return null

  return (
    <motion.section
      className={`${surfaces.raised} ${styles.outcome}`}
      aria-labelledby="vnext-predictor-outcome"
      variants={rise}
      initial="hidden"
      animate="visible"
    >
      <div className={styles.outcomeTotal}>
        <h2 id="vnext-predictor-outcome" className={typography.label}>
          {model.matchweek.label} banked
        </h2>
        <p className={`${typography.display} ${styles.outcomePoints}`}>
          {formatNumber(settledPoints)}
          <span className={typography.label}> pts</span>
        </p>
        {model.joker.playedHere ? (
          <p className={typography.caption}>Your Joker doubled this matchweek.</p>
        ) : null}
        {onShare ? (
          <button type="button" className={styles.outcomeShare} onClick={onShare}>
            Share this matchweek
          </button>
        ) : null}
      </div>

      {tally === null ? null : (
        <dl className={styles.outcomeSplit}>
          <Count label="Exact" value={tally.exact} tone="hit" />
          <Count label="Right result" value={tally.result} tone="accent" />
          <Count label="Missed" value={tally.missed} tone="miss" />
          {/* Blank is shown only when there were any. A zero here would invite a
              player to read it as a criticism of a card they actually completed. */}
          {tally.blank === 0 ? null : <Count label="Not predicted" value={tally.blank} tone="muted" />}
        </dl>
      )}
    </motion.section>
  )
}

function Count({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'hit' | 'accent' | 'miss' | 'muted'
}) {
  return (
    <div className={styles.outcomeCount} data-tone={tone}>
      <dt className={typography.micro}>{label}</dt>
      <dd className={`${typography.title} ${typography.numeric} ${styles.outcomeCountValue}`}>
        {value}
      </dd>
    </div>
  )
}
