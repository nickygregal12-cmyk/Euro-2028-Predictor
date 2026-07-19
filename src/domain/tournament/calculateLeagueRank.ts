// Pure domain function: ranks league entries by total points, breaking ties
// with the section-5 criteria of docs/scoring-rules.md. No UI, no database
// access — data in, data out. Deterministic: same entries, same ranking.
//
// Section 5 tie-breakers, applied in order until the tie is broken:
//   1. Most exact scores
//   2. Most correct outcomes
//   3. Most correct knockout teams
//   4. Correct champion
//   5. Closest total-goals prediction (smallest absolute difference)
// Unlike group-table ties there is no manual step: entries still level after
// all five genuinely share a position (joint rank).

import type { ScoreBreakdown } from './calculateScore'

export type LeagueEntry = {
  entryId: string
  totalPoints: number
  // Tie-break stats, in section-5 order:
  exactScores: number // 1
  correctOutcomes: number // 2 (matches where the outcome was right, incl. exact scores)
  correctKnockoutTeams: number // 3 (teams that earned any progression points)
  correctChampion: boolean // 4
  totalGoalsDiff: number | null // 5 (|predicted − actual|; null = no prediction → ranked last)
}

export type RankedLeagueEntry = LeagueEntry & {
  // 1-based position. Entries level on every criterion share a rank (standard
  // competition ranking: e.g. 1, 1, 3).
  rank: number
  // true when this entry shares its rank with at least one other entry.
  tied: boolean
}

// Compare two entries: negative if a should rank above b. Every criterion is
// applied in order until one separates them.
function compareEntries(a: LeagueEntry, b: LeagueEntry): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
  if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores
  if (b.correctOutcomes !== a.correctOutcomes) return b.correctOutcomes - a.correctOutcomes
  if (b.correctKnockoutTeams !== a.correctKnockoutTeams) {
    return b.correctKnockoutTeams - a.correctKnockoutTeams
  }
  const champA = a.correctChampion ? 1 : 0
  const champB = b.correctChampion ? 1 : 0
  if (champB !== champA) return champB - champA
  // Smaller total-goals difference is better; a missing prediction ranks last.
  const diffA = a.totalGoalsDiff ?? Infinity
  const diffB = b.totalGoalsDiff ?? Infinity
  if (diffA !== diffB) return diffA - diffB
  return 0
}

/**
 * Ranks league entries best-to-worst. Stable, so entries that are level on
 * every criterion keep their input order and share a rank.
 */
export function calculateLeagueRank(entries: LeagueEntry[]): RankedLeagueEntry[] {
  const sorted = [...entries].sort(compareEntries)

  const ranked: RankedLeagueEntry[] = []
  for (let i = 0; i < sorted.length; i++) {
    const sameAsPrev =
      i > 0 && compareEntries(sorted[i - 1], sorted[i]) === 0
    const rank = sameAsPrev ? ranked[i - 1].rank : i + 1
    ranked.push({ ...sorted[i], rank, tied: false })
  }

  // Flag every entry that shares its rank with another.
  const rankCounts = new Map<number, number>()
  for (const e of ranked) rankCounts.set(e.rank, (rankCounts.get(e.rank) ?? 0) + 1)
  for (const e of ranked) e.tied = (rankCounts.get(e.rank) ?? 0) > 1

  return ranked
}

/**
 * Derives the section-5 tie-break stats for one entry from its score breakdown
 * (the output of calculateScore). Keeps the meaning of each tie-break metric in
 * one place so callers don't have to reinterpret the rules.
 */
export function leagueTieBreakStats(
  breakdown: ScoreBreakdown
): Omit<LeagueEntry, 'entryId' | 'totalPoints'> {
  const matches = breakdown.groupMatches.items
  return {
    exactScores: matches.filter((m) => m.kind === 'exact').length,
    // An exact score is also a correct outcome.
    correctOutcomes: matches.filter((m) => m.kind === 'exact' || m.kind === 'correct').length,
    correctKnockoutTeams: breakdown.knockout.items.filter((k) => k.points > 0).length,
    correctChampion: breakdown.knockout.items.some((k) =>
      k.correctStages.includes('CHAMPION')
    ),
    totalGoalsDiff: breakdown.bonus.totalGoals.diff ?? null,
  }
}
