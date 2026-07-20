// Pure domain for rank_history capture (design-system §6, Phase 3 graph). The
// SQL capture (20260720180000_add_rank_history.sql) implements exactly this
// completeness rule; keeping it here makes the "capture the moment a matchday is
// fully scored" logic unit-testable without a database. No React, no DB.

export type MatchdayKey = 'MD1' | 'MD2' | 'MD3' | 'R16' | 'QF' | 'SF' | 'FINAL'

// The whole-tournament snapshot points, in x-axis order. A "matchday" spans
// group MD1..3 (matches.matchday) plus the four knockout rounds (matches.round);
// matches.matchday alone is group-stage only, so the mapping is defined here and
// mirrored in the migration.
export const MATCHDAY_POINTS: {
  key: MatchdayKey
  ord: number
  round: string
  matchday: number | null
}[] = [
  { key: 'MD1', ord: 1, round: 'group', matchday: 1 },
  { key: 'MD2', ord: 2, round: 'group', matchday: 2 },
  { key: 'MD3', ord: 3, round: 'group', matchday: 3 },
  { key: 'R16', ord: 4, round: 'r16', matchday: null },
  { key: 'QF', ord: 5, round: 'qf', matchday: null },
  { key: 'SF', ord: 6, round: 'sf', matchday: null },
  { key: 'FINAL', ord: 7, round: 'final', matchday: null },
]

export type MatchState = { round: string; matchday: number | null; hasResult: boolean }

/**
 * The matchday keys that are FULLY SCORED for a set of matches (every match in
 * the matchday has a result), in x-axis order. These are exactly the points at
 * which a snapshot is captured — so an empty/partial matchday yields nothing,
 * and the first completed matchday triggers the first snapshot.
 */
export function completedMatchdays(matches: MatchState[]): MatchdayKey[] {
  return MATCHDAY_POINTS.filter((p) => {
    const inMatchday = matches.filter(
      (m) => m.round === p.round && (p.matchday === null || m.matchday === p.matchday),
    )
    return inMatchday.length > 0 && inMatchday.every((m) => m.hasResult)
  }).map((p) => p.key)
}
