import { ordinal } from '../league/ordinal'
import h from './home.module.css'

export type StatStripProps = {
  totalPoints: number
  pointsToday: number
  rank: number | null
  entryCount: number
  bestLeagueRank: number | null
  hasLeague: boolean
  onPoints: () => void
  onToday: () => void
  onRank: () => void
  onLeague: () => void
}

/**
 * The during-tournament stat strip (design-system §6): four tappable segments in
 * one card — total Points, Points Today (accent), overall rank, best-league
 * position. Each taps through to its source screen. Presentational.
 *
 * NOTE: rank "movement arrow" from the spec is intentionally absent — it needs
 * per-matchday rank snapshots (rank_history), a Phase 2/3 boundary roadmap item
 * not built yet. Wire the arrow here once rank_history lands.
 */
export function StatStrip({
  totalPoints,
  pointsToday,
  rank,
  entryCount,
  bestLeagueRank,
  hasLeague,
  onPoints,
  onToday,
  onRank,
  onLeague,
}: StatStripProps) {
  return (
    <div className={h.stripCard}>
      <button type="button" className={h.stripSeg} onClick={onPoints}>
        <span className={h.stripValue}>{totalPoints}</span>
        <span className={h.stripLabel}>Points</span>
      </button>
      <button type="button" className={h.stripSeg} onClick={onToday}>
        <span className={`${h.stripValue} ${h.stripAccent}`}>
          {pointsToday > 0 ? `+${pointsToday}` : pointsToday}
        </span>
        <span className={h.stripLabel}>Points today</span>
      </button>
      <button type="button" className={h.stripSeg} onClick={onRank}>
        <span className={h.stripValue}>{rank === null ? '–' : ordinal(rank)}</span>
        <span className={h.stripLabel}>
          {rank === null ? 'Overall rank' : `of ${entryCount} overall`}
        </span>
      </button>
      <button type="button" className={h.stripSeg} onClick={onLeague}>
        <span className={h.stripValue}>
          {!hasLeague ? '–' : bestLeagueRank === null ? '–' : ordinal(bestLeagueRank)}
        </span>
        <span className={h.stripLabel}>{hasLeague ? 'Best league' : 'No league yet'}</span>
      </button>
    </div>
  )
}
