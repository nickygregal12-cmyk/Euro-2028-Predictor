import { ordinal } from '../league/ordinal'
import h from './home.module.css'

export type StatStripProps = {
  totalPoints: number | null
  pointsToday: number | null
  rank: number | null
  entryCount: number | null
  bestLeagueRank: number | null
  hasLeague: boolean | null
  leagueDataAvailable?: boolean
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
 * Null numeric values mean the source request was unavailable, not that the
 * player has zero points. League availability is explicit because `null` best
 * rank can also be a legitimate pre-scoring state. Existing presentational
 * callers default to a successful league read.
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
  leagueDataAvailable = true,
  onPoints,
  onToday,
  onRank,
  onLeague,
}: StatStripProps) {
  const leaderboardAvailable = totalPoints !== null && entryCount !== null

  return (
    <div className={h.stripCard}>
      <button type="button" className={h.stripSeg} onClick={onPoints}>
        <span className={h.stripValue}>{totalPoints ?? '–'}</span>
        <span className={h.stripLabel}>
          {totalPoints === null ? 'Points unavailable' : 'Points'}
        </span>
      </button>
      <button type="button" className={h.stripSeg} onClick={onToday}>
        <span className={`${h.stripValue} ${h.stripAccent}`}>
          {pointsToday === null ? '–' : pointsToday > 0 ? `+${pointsToday}` : pointsToday}
        </span>
        <span className={h.stripLabel}>
          {pointsToday === null ? 'Today unavailable' : 'Points today'}
        </span>
      </button>
      <button type="button" className={h.stripSeg} onClick={onRank}>
        <span className={h.stripValue}>
          {!leaderboardAvailable || rank === null ? '–' : ordinal(rank)}
        </span>
        <span className={h.stripLabel}>
          {!leaderboardAvailable
            ? 'Rank unavailable'
            : rank === null
              ? 'Overall rank'
              : `of ${entryCount} overall`}
        </span>
      </button>
      <button type="button" className={h.stripSeg} onClick={onLeague}>
        <span className={h.stripValue}>
          {!leagueDataAvailable || !hasLeague || bestLeagueRank === null
            ? '–'
            : ordinal(bestLeagueRank)}
        </span>
        <span className={h.stripLabel}>
          {!leagueDataAvailable
            ? 'Leagues unavailable'
            : hasLeague
              ? 'Best league'
              : 'No league yet'}
        </span>
      </button>
    </div>
  )
}
