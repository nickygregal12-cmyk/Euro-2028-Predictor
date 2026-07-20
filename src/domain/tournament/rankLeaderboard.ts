// Pure standard-competition ranking for the overall leaderboard (design-system
// §6 League tab). Ranks by total points; tied totals share a rank (1, 1, 3) and
// are ordered alphabetically by display name within the tie. No UI, no database.
//
// Note: the section-5 league tie-breakers are NOT applied here — the design doc
// applies those only to final standings at tournament end. This is the running,
// display ranking.

export type LeaderboardEntry = {
  displayName: string
  totalPoints: number
  isYou: boolean
}

// The rank fields standard-competition ranking adds to an entry.
export type RankFields = {
  // 1-based standard-competition rank (shared on ties). Null when there is
  // nothing to rank yet — every entry is level (e.g. pre-results, all zero) —
  // so the UI shows the entry-count framing instead of a wall of tied 1sts.
  rank: number | null
  tied: boolean
}

export type RankedEntry = LeaderboardEntry & RankFields

function byNameThenPoints(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
}

/**
 * Orders entries best-first (points desc, then name A→Z) and assigns
 * standard-competition ranks. When every entry has the same total (no results
 * yet), ranks are null — the leaderboard is pre-results and should be framed by
 * entry count, not a tie for first.
 *
 * Generic over the entry type so callers with richer rows (league members,
 * carrying ownership/entry flags) keep their extra fields on the ranked output —
 * one ranking implementation for the overall leaderboard and every league.
 */
export function rankLeaderboard<T extends LeaderboardEntry>(entries: T[]): (T & RankFields)[] {
  const sorted = [...entries].sort(byNameThenPoints)

  const distinctTotals = new Set(sorted.map((e) => e.totalPoints)).size
  const preResults = distinctTotals <= 1 // all level → nothing to rank yet

  // Count entries per total to know which ranks are shared.
  const countByTotal = new Map<number, number>()
  for (const e of sorted) countByTotal.set(e.totalPoints, (countByTotal.get(e.totalPoints) ?? 0) + 1)

  return sorted.map((entry) => {
    // Standard competition ranking: rank = 1 + number of entries strictly above.
    const rank = preResults
      ? null
      : 1 + sorted.filter((e) => e.totalPoints > entry.totalPoints).length
    const tied = !preResults && (countByTotal.get(entry.totalPoints) ?? 0) > 1
    return { ...entry, rank, tied }
  })
}
