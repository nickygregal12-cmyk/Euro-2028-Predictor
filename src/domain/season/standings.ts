/**
 * Domestic season standings authority.
 *
 * Authority: ADR 0012. The cumulative total is the only ranking that decides
 * the season. Everything else here — matchweek winners, rolling form, monthly
 * tables — is a derived retention view computed FROM settled matchweek totals
 * and must never feed back into the canonical total.
 *
 * Standings display matches played alongside points, as a real league table
 * shows games in hand: two players on 84 points from 22 and 23 matchweeks are
 * not tied in meaning, even though only points decide rank.
 *
 * Pure domain: no storage, network or ambient clock. Matchweek totals arrive
 * already settled (and already Joker-doubled) from `scoring.ts`.
 */

export type SettledMatchweekTotal = {
  matchweek: number
  /** The matchweek's final points, after any Joker. */
  points: number
}

export type SeasonEntryTotals = {
  entryId: string
  matchweeks: readonly SettledMatchweekTotal[]
}

export type SeasonStandingRow = {
  entryId: string
  rank: number
  points: number
  matchweeksPlayed: number
}

function isValidTotal(total: SettledMatchweekTotal): boolean {
  return (
    Number.isInteger(total.matchweek) &&
    total.matchweek >= 1 &&
    Number.isInteger(total.points) &&
    total.points >= 0
  )
}

/**
 * Whether an entry's totals are well-formed: valid rows, no duplicated
 * matchweek. Malformed data never ranks — a season table with an invented
 * row in it is worse than no table.
 */
function validEntry(entry: SeasonEntryTotals): boolean {
  if (entry.entryId.trim().length === 0) return false
  const seen = new Set<number>()
  for (const total of entry.matchweeks) {
    if (!isValidTotal(total) || seen.has(total.matchweek)) return false
    seen.add(total.matchweek)
  }
  return true
}

/**
 * The season table. Ranked by cumulative points alone; equal points share a
 * rank and the next rank skips (standard competition ranking). Returns `null`
 * when any entry is malformed or an entry id repeats — fail closed rather
 * than rank invented data.
 */
export function computeSeasonStandings(
  entries: readonly SeasonEntryTotals[],
): SeasonStandingRow[] | null {
  const ids = new Set<string>()
  for (const entry of entries) {
    if (!validEntry(entry) || ids.has(entry.entryId)) return null
    ids.add(entry.entryId)
  }

  const rows = entries
    .map((entry) => ({
      entryId: entry.entryId,
      points: entry.matchweeks.reduce((sum, total) => sum + total.points, 0),
      matchweeksPlayed: entry.matchweeks.length,
    }))
    .sort((left, right) =>
      right.points === left.points
        ? left.entryId.localeCompare(right.entryId)
        : right.points - left.points,
    )

  let previousPoints = -1
  let previousRank = 0
  return rows.map((row, index) => {
    const rank = row.points === previousPoints ? previousRank : index + 1
    previousPoints = row.points
    previousRank = rank
    return { ...row, rank }
  })
}

export type MatchweekWinners = {
  matchweek: number
  /** Every entry on the top score; a tie means several winners, not none. */
  entryIds: readonly string[]
  points: number
}

/**
 * The winner(s) of one matchweek among the entries that have a settled total
 * for it. Entries that did not play the matchweek are not "on zero" — they
 * are absent. Returns `null` for malformed input or when nobody settled the
 * matchweek.
 */
export function matchweekWinners(
  entries: readonly SeasonEntryTotals[],
  matchweek: number,
): MatchweekWinners | null {
  if (!Number.isInteger(matchweek) || matchweek < 1) return null
  const ids = new Set<string>()
  for (const entry of entries) {
    if (!validEntry(entry) || ids.has(entry.entryId)) return null
    ids.add(entry.entryId)
  }

  const settled = entries.flatMap((entry) => {
    const total = entry.matchweeks.find((item) => item.matchweek === matchweek)
    return total === undefined ? [] : [{ entryId: entry.entryId, points: total.points }]
  })
  if (settled.length === 0) return null

  const top = Math.max(...settled.map((item) => item.points))
  return {
    matchweek,
    points: top,
    entryIds: settled
      .filter((item) => item.points === top)
      .map((item) => item.entryId)
      .sort(),
  }
}

/**
 * Rolling form: the sum of an entry's last `windowSize` settled matchweek
 * totals, most recent by matchweek number. A derived view only — it must
 * never feed a canonical total. Returns `null` on malformed input.
 */
export function rollingFormPoints(
  entry: SeasonEntryTotals,
  windowSize: number,
): number | null {
  if (!validEntry(entry) || !Number.isInteger(windowSize) || windowSize < 1) return null
  return [...entry.matchweeks]
    .sort((left, right) => right.matchweek - left.matchweek)
    .slice(0, windowSize)
    .reduce((sum, total) => sum + total.points, 0)
}
