import { ordinal } from '../league/ordinal'
import {
  RANK_HISTORY_CHECKPOINTS,
  type H2HRankHistory,
  type RankHistoryPoint,
} from '../../services/supabase/h2hRankHistoryModel'
import h from './h2h.module.css'

export type RankHistoryComparisonProps = {
  youName: string
  rivalName: string
  history: H2HRankHistory
}

const WIDTH = 640
const HEIGHT = 220
const LEFT = 38
const RIGHT = 18
const TOP = 20
const BOTTOM = 30

function pointMap(points: RankHistoryPoint[]): Map<number, RankHistoryPoint> {
  return new Map(points.map((point) => [point.order, point]))
}

function xFor(order: number): number {
  return LEFT + ((order - 1) / (RANK_HISTORY_CHECKPOINTS.length - 1)) * (WIDTH - LEFT - RIGHT)
}

function yFor(rank: number, maxRank: number): number {
  if (maxRank <= 1) return TOP
  return TOP + ((rank - 1) / (maxRank - 1)) * (HEIGHT - TOP - BOTTOM)
}

function pathFor(points: RankHistoryPoint[], maxRank: number): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.order)} ${yFor(point.rank, maxRank)}`)
    .join(' ')
}

function RankCell({ point }: { point: RankHistoryPoint | undefined }) {
  if (!point) return <span className={h.historyMissing}>–</span>
  return (
    <span className={h.historyCellValue}>
      <strong>{ordinal(point.rank)}</strong>
      <small>{point.totalPoints} pts</small>
    </span>
  )
}

/**
 * Seven-checkpoint rank comparison. The SVG is a visual summary; the visible
 * table underneath is the complete accessible equivalent and handles gaps.
 */
export function RankHistoryComparison({
  youName,
  rivalName,
  history,
}: RankHistoryComparisonProps) {
  const points = [...history.you, ...history.rival]
  const maxRank = Math.max(1, ...points.map((point) => point.rank))
  const youByOrder = pointMap(history.you)
  const rivalByOrder = pointMap(history.rival)

  return (
    <section className={h.historyCard} aria-labelledby="h2h-rank-history-heading">
      <div className={h.sectionHeadingRow}>
        <div>
          <span className={h.sectionEyebrow}>Rank over time</span>
          <h2 id="h2h-rank-history-heading" className={h.sectionTitle}>
            Seven tournament checkpoints
          </h2>
        </div>
        {/* `aria-label` is prohibited on a roleless div — the implicit role is
            generic, which cannot carry a name, so the label reached nobody.
            `role="group"` permits it. */}
        <div className={h.historyLegend} role="group" aria-label="Rank history legend">
          <span><i className={h.historyLegendYou} />You</span>
          <span><i className={h.historyLegendRival} />{rivalName}</span>
        </div>
      </div>

      {points.length === 0 ? (
        <p className={h.historyEmpty}>
          Rank history appears after the first completed tournament checkpoint.
        </p>
      ) : (
        <>
          {/* Same scrollable-region rule as the table below: `.historyChartWrap`
              and `.historyTableWrap` share one `overflow-x: auto` declaration, so
              both need to be reachable by keyboard (WCAG 2.1.1). The table was
              fixed first because axe named it; this one was named on the next
              run. The chart's own `role="img"` is not focusable, so the scroll
              container has to be. */}
          <div
            className={h.historyChartWrap}
            tabIndex={0}
            role="group"
            aria-label="Rank history chart, scrollable"
          >
            <svg
              className={h.historyChart}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-labelledby="h2h-rank-chart-title h2h-rank-chart-description"
            >
              <title id="h2h-rank-chart-title">Rank history comparison</title>
              <desc id="h2h-rank-chart-description">
                Lower positions on the chart represent a worse rank. The table below gives every
                recorded rank and points total for {youName} and {rivalName}.
              </desc>
              <line x1={LEFT} y1={TOP} x2={WIDTH - RIGHT} y2={TOP} className={h.historyGrid} />
              <line
                x1={LEFT}
                y1={HEIGHT - BOTTOM}
                x2={WIDTH - RIGHT}
                y2={HEIGHT - BOTTOM}
                className={h.historyGrid}
              />
              {RANK_HISTORY_CHECKPOINTS.map((checkpoint) => (
                <line
                  key={checkpoint.key}
                  x1={xFor(checkpoint.order)}
                  y1={TOP}
                  x2={xFor(checkpoint.order)}
                  y2={HEIGHT - BOTTOM}
                  className={h.historyGridVertical}
                />
              ))}
              <text x={LEFT - 8} y={TOP + 4} textAnchor="end" className={h.historyAxisLabel}>1</text>
              <text
                x={LEFT - 8}
                y={HEIGHT - BOTTOM + 4}
                textAnchor="end"
                className={h.historyAxisLabel}
              >
                {maxRank}
              </text>
              {history.you.length > 0 && (
                <path d={pathFor(history.you, maxRank)} className={h.historyPathYou} />
              )}
              {history.rival.length > 0 && (
                <path d={pathFor(history.rival, maxRank)} className={h.historyPathRival} />
              )}
              {history.you.map((point) => (
                <circle
                  key={`you-${point.key}`}
                  cx={xFor(point.order)}
                  cy={yFor(point.rank, maxRank)}
                  r="5"
                  className={h.historyPointYou}
                />
              ))}
              {history.rival.map((point) => (
                <circle
                  key={`rival-${point.key}`}
                  cx={xFor(point.order)}
                  cy={yFor(point.rank, maxRank)}
                  r="5"
                  className={h.historyPointRival}
                />
              ))}
            </svg>
          </div>

          {/* `overflow-x: auto` makes this a scrollable region, and a scrollable
              region a keyboard user cannot reach or scroll fails WCAG 2.1.1.
              `tabIndex={0}` puts it in the tab order; the role and label say what
              has been focused rather than announcing a bare group. */}
          <div
            className={h.historyTableWrap}
            tabIndex={0}
            role="group"
            aria-label="Rank history table, scrollable"
          >
            <table className={h.historyTable}>
              <caption className={h.visuallyHidden}>Rank and total points at each checkpoint</caption>
              <thead>
                <tr>
                  <th scope="col">Checkpoint</th>
                  <th scope="col">You</th>
                  <th scope="col">{rivalName}</th>
                </tr>
              </thead>
              <tbody>
                {RANK_HISTORY_CHECKPOINTS.map((checkpoint) => (
                  <tr key={checkpoint.key}>
                    <th scope="row">{checkpoint.label}</th>
                    <td><RankCell point={youByOrder.get(checkpoint.order)} /></td>
                    <td><RankCell point={rivalByOrder.get(checkpoint.order)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
