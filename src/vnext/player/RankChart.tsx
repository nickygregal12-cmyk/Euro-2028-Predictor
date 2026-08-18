import type { RankPoint } from '../models/playerProfile'
import { rankBounds, rankPlot, rankPointKey } from '../models/playerProfile'
import { formatNumber, formatOrdinal } from '../foundations/format'
import text from '../foundations/typography.module.css'
import styles from './playerProfile.module.css'

/**
 * WHERE THIS PLAYER STOOD, WEEK BY WEEK.
 *
 * ============================ IT PLOTS A POSITION, NOT A TOTAL ===========
 *
 * The Stage 10 predicate turns on this and contract 192's RPC states the reason
 * beside the field it added: points over time is derivable from the matchweek
 * scores, POSITION over time is not. A running points total is a line that only
 * ever climbs, drawn for a player who may have been overtaken every week — it
 * looks like a chart and answers a question nobody asked.
 *
 * The `cumulativePoints` on each `RankPoint` is deliberately NOT plotted here.
 * It appears in the text equivalent beside the rank, where it is context — and
 * it is a RUNNING SEASON TOTAL rather than that matchweek's score, which is why
 * the column is headed "Season points after".
 *
 * ============================ THE GEOMETRY IS THE MODEL'S ================
 *
 * `rankPlot` returns fractions and `rankBounds` returns the numbers the axis is
 * labelled with, and they come from ONE calculation. That matters more than it
 * looks: a rank improves as it FALLS, so the axis is inverted, and a chart
 * scaled by one rule and captioned by another would be upside down in exactly
 * the way nobody notices. This component turns fractions into a viewBox and
 * nothing else — no min, no max, no sort, no scale of its own.
 *
 * ============================ THE AXIS IS ZOOMED, AND SAYS SO ============
 *
 * A season spent between 4th and 7th in a field of 412 is a flat line across
 * the whole plot — the entire truth and no information. So the chart is scaled
 * to the range actually occupied and the axis PRINTS THAT RANGE. A zoomed axis
 * with stated bounds is honest; an unlabelled one is the classic chart lie.
 *
 * ============================ IT IS READABLE WITHOUT SEEING IT ===========
 *
 * The drawing is `aria-hidden` and a real `<table>` carries the same series for
 * a screen reader and for anyone with the stylesheet off. Both are rendered
 * from the SAME array, so they cannot drift; the table is the authority and the
 * line is the illustration.
 */

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 132
/** Room for the markers and the stroke, so an endpoint is never half-clipped. */
const PAD = 10

export type RankChartProps = {
  readonly series: readonly RankPoint[]
  /** Names the chart for assistive technology. The player, in words. */
  readonly caption: string
}

export function RankChart({ series, caption }: RankChartProps) {
  const bounds = rankBounds(series)
  const plotted = rankPlot(series)

  if (bounds === null) {
    // NOT AN ERROR. A season before its first settlement has no positions yet,
    // and an empty axis with no line would read as a player who fell off it.
    return (
      <p className={`${text.body} ${styles.chartEmpty}`}>
        No matchweek has settled yet, so there is no position to plot.
      </p>
    )
  }

  const path = plotted
    .map((entry, index) => {
      const x = PAD + entry.x * (VIEW_WIDTH - PAD * 2)
      const y = PAD + entry.y * (VIEW_HEIGHT - PAD * 2)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  const last = plotted[plotted.length - 1]

  return (
    <figure className={styles.chart} data-vnext-zone="rank-chart">
      <div className={styles.chartFrame}>
        {/* THE AXIS LABELS ARE THE BOUNDS THE LINE WAS SCALED BY. Same two
            numbers, one calculation — see the header. */}
        <div className={styles.chartAxis} aria-hidden="true">
          <span className={text.micro}>{formatOrdinal(bounds.best)}</span>
          <span className={text.micro}>{formatOrdinal(bounds.worst)}</span>
        </div>
        <svg
          className={styles.chartPlot}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="presentation"
          aria-hidden="true"
          focusable="false"
        >
          {plotted.length > 1 ? (
            <path className={styles.chartLine} d={path} />
          ) : null}
          {plotted.map((entry) => (
            <circle
              key={rankPointKey(entry.point)}
              className={
                entry === last
                  ? `${styles.chartDot} ${styles.chartDotLast}`
                  : styles.chartDot
              }
              cx={PAD + entry.x * (VIEW_WIDTH - PAD * 2)}
              cy={PAD + entry.y * (VIEW_HEIGHT - PAD * 2)}
              r={entry === last ? 5 : 3}
            />
          ))}
        </svg>
      </div>

      <figcaption className={`${text.micro} ${styles.chartCaption}`}>
        {/* THE FIELD IS NAMED, because 7th of 412 and 7th of 60 are different
            facts, and `fieldChanged` is the case where one number would be
            wrong for most of the line. */}
        {bounds.fieldChanged
          ? `Position after each settled matchweek, in a field that changed over the season — ${formatNumber(bounds.fieldSize)} players now.`
          : `Position after each settled matchweek, out of ${formatNumber(bounds.fieldSize)} players.`}
      </figcaption>

      {/* THE SAME SERIES, AS A TABLE. Not a summary of the chart — the chart is
          an illustration of this. Visually hidden, fully navigable.

          THE HIDING GOES ON A WRAPPING DIV AND NOT ON THE TABLE. `width: 1px`
          is only a MINIMUM for a table, which then sizes to its content, so
          `.srOnly` applied to a `<table>` leaves a 364-pixel absolutely
          positioned box — clipped and invisible, but contributing its width to
          the scrollable overflow of whatever positioned ancestor it happens to
          land in. A block honours the 1px. (It was NOT the cause of the 375
          overflow this suite caught; that was `.recentOutcome`. This is the
          latent version of the same class of fault.) */}
      <div className={text.srOnly}>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Matchweek</th>
              <th scope="col">Position</th>
              {/* THE SEASON TOTAL AFTER THIS MATCHWEEK, and the heading has to
                  say so. The RPC's figure is a running sum; the profile panel
                  below draws contract 151's per-matchweek score, and captioning
                  both as "points that matchweek" would put two different
                  numbers for one matchweek on one page. */}
              <th scope="col">Season points after</th>
            </tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={rankPointKey(point)}>
                <th scope="row">{point.label}</th>
                <td>
                  {formatOrdinal(point.rank)} of {formatNumber(point.fieldSize)}
                </td>
                <td>{formatNumber(point.cumulativePoints)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
