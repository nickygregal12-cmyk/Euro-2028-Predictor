import { useId } from 'react'
import type { MatchPredictorFixture } from './matchPredictorModel'
import { presentClosestMisses } from './closestMissModel'
import styles from './SeasonClosestMisses.module.css'

/**
 * `INNOV-014` on a settled matchweek card.
 *
 * IT IS VISUALLY SEPARATE FROM THE OFFICIAL TOTAL, deliberately: a dashed panel
 * headed "What if", below the card, with every figure worded as a conditional.
 * A hypothetical that looks like a result is the failure mode this whole
 * feature invites.
 *
 * IT APPEARS ONLY WHERE THERE IS A NEAR MISS. A perfect matchweek and a
 * hopeless one both render nothing — the first has nothing to regret and the
 * second would be a list of every fixture, which is not a story.
 *
 * IT ADDS NO READ. Predictions and results are the matchweek card's, already on
 * the page.
 */

export type SeasonClosestMissesProps = {
  fixtures: readonly MatchPredictorFixture[]
}

export function SeasonClosestMisses({ fixtures }: SeasonClosestMissesProps) {
  const headingId = useId()
  const view = presentClosestMisses(fixtures)

  if (view.misses.length === 0) return null

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h3 className={styles.heading} id={headingId}>
        What if
      </h3>
      <p className={styles.lede}>
        Hypothetical only. Your matchweek total is unchanged — these are what the near misses
        would have been worth if the scorelines had landed.
      </p>

      <ul className={styles.misses}>
        {view.misses.map((miss) => (
          <li className={styles.miss} key={miss.fixtureId}>
            <span className={styles.fixture}>
              {miss.home} v {miss.away}
            </span>
            <span className={styles.scores}>
              You said {miss.prediction} · finished {miss.result}
            </span>
            <span className={styles.line}>{miss.line}</span>
          </li>
        ))}
      </ul>

      <p className={styles.total}>
        {view.pointsMissed} points would have been added across every near miss in this matchweek.
        None of them was.
      </p>
    </section>
  )
}
