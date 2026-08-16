import type { HomeModel } from '../../models/home'
import { formatShare } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import styles from './command.module.css'

export type CommandTrendProps = {
  model: HomeModel
}

/**
 * The season so far: matchweek points and what the predictions were worth.
 *
 * DRAWN IN CSS, NOT CHARTED. Four bars and a three-part split are a layout, not
 * a visualisation, and adding a chart library to draw them would be a
 * dependency bought for one panel. The bars are a labelled list; the split is
 * three labelled segments with the numbers written out beside them. Both read
 * in greyscale, both survive text scaling, and neither needs a tooltip to be
 * understood.
 *
 * The current matchweek is marked in words as well as by colour, because a
 * highlighted bar with no label is a colour carrying a state on its own.
 */
export function CommandTrend({ model }: CommandTrendProps) {
  const history = model.recentPerformance.matchweekHistory
  const peak = Math.max(...history.map((entry) => entry.points), 1)
  const current = model.competition.matchweekNumber
  const { accuracy } = model.recentPerformance

  const segments = [
    { key: 'exact', label: 'Exact', value: accuracy.exact, tone: styles.splitExact },
    {
      key: 'result',
      label: 'Result only',
      value: accuracy.resultOnly,
      tone: styles.splitResult,
    },
    { key: 'missed', label: 'Missed', value: accuracy.missed, tone: styles.splitMissed },
  ]

  return (
    <div className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={`${typography.label} ${styles.panelTitle}`}>Season so far</h2>
        <p className={typography.micro}>
          {accuracy.predicted} predictions made this season
        </p>
      </header>

      <ul className={styles.bars}>
        {history.map((entry) => {
          const isCurrent = entry.matchweek === current
          return (
            <li
              key={entry.matchweek}
              className={`${styles.barItem} ${isCurrent ? styles.barCurrent : ''}`}
            >
              <span className={`${styles.barValue} ${typography.numeric}`}>
                {entry.points}
              </span>
              <span
                className={styles.barTrack}
                // A bar is a picture of the number written above it, so it is
                // decorative: the figure and the label already say everything.
                aria-hidden="true"
              >
                <span
                  className={styles.barFill}
                  style={{ blockSize: `${Math.round((entry.points / peak) * 100)}%` }}
                />
              </span>
              <span className={typography.micro}>
                MW{entry.matchweek}
                {isCurrent ? ' · now' : ''}
              </span>
            </li>
          )
        })}
      </ul>

      <div className={styles.split}>
        <span className={typography.label}>How they landed</span>
        <span
          className={styles.splitBar}
          role="img"
          aria-label={`Of ${accuracy.predicted} predictions: ${accuracy.exact} exact, ${accuracy.resultOnly} right result only, ${accuracy.missed} missed`}
        >
          {segments.map((segment) => (
            <span
              key={segment.key}
              className={`${styles.splitSegment} ${segment.tone}`}
              style={{ flexGrow: segment.value }}
            />
          ))}
        </span>
        <ul className={styles.splitLegend}>
          {segments.map((segment) => (
            <li key={segment.key} className={styles.splitLegendItem}>
              <span
                className={`${styles.splitSwatch} ${segment.tone}`}
                aria-hidden="true"
              />
              <span className={typography.micro}>
                {segment.label} · {segment.value} (
                {formatShare(segment.value / Math.max(accuracy.predicted, 1))})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
