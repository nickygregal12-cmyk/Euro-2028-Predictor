import type {
  SeasonLeaderboardPage,
  SeasonLeaderboardRow,
  SeasonLeaderboardYou,
} from '../../services/supabase/seasonLeaderboard'

/**
 * Presentation model for the season Match Predictor standings.
 *
 * THIS IS A GAME SURFACE, NOT A COMPETITION SURFACE, and that is the decision
 * that shapes everything below. `CLAUDE.md` and ADR 0011 hold the line: a
 * competition season supplies real football, while each prediction game is
 * joined separately and "owns its own rules, entry/state, scoring or
 * progression and standings" — and the separation "must be visible in the
 * interface as well as true in storage". `get_season_leaderboard` ranks
 * settled Match Predictor matchweeks, so this table belongs to that game and
 * is reached through it. It is deliberately NOT a "Standings" entry in the
 * competition sub-navigation, because a competition-level standings tab would
 * assert exactly the combined authority ADR 0011 forbids: two games running in
 * one season would then compete for the same slot with no honest answer.
 *
 * POINTS TRAVEL WITH MATCHWEEKS PLAYED, ALWAYS. ADR 0012 pairs them because
 * "two players on 84 points from 22 and 23 matchweeks are not tied in
 * meaning", and a table that showed only the total would flatter whoever
 * joined earliest. The parser already refuses a payload missing the count;
 * this model refuses to render a row without it for the same reason.
 *
 * RANK AND POSITION ARE DIFFERENT NUMBERS and both come from the server.
 * Position is where the row sits in the ordering; rank is what the player
 * shares with anyone level on points. Recomputing either in the browser would
 * put a second ranking authority in the client, so neither is derived here —
 * the model only decides how to *show* the distinction.
 */

export type StandingsRow = {
  key: string
  /** What to print in the rank column: "4" or "=4" when the rank is shared. */
  rankLabel: string
  rank: number
  displayName: string
  points: number
  matchweeksPlayed: number
  isYou: boolean
  /** Screen-reader sentence; the visual row is a table of numbers. */
  accessibleSummary: string
}

export type StandingsView = {
  rows: readonly StandingsRow[]
  /**
   * The caller's own row when it fell outside the loaded pages, so a player
   * ranked 400th still sees where they stand without paging to find out.
   * Null when they are already visible above, or when they hold no settled
   * matchweek yet.
   */
  pinnedYou: StandingsRow | null
  totalCount: number
  hasMore: boolean
  nextCursor: string | null
}

function summarise(row: {
  rank: number
  tied: boolean
  displayName: string
  points: number
  matchweeksPlayed: number
  isYou: boolean
}): string {
  const rank = row.tied ? `joint ${row.rank}` : `${row.rank}`
  const played = row.matchweeksPlayed === 1 ? '1 matchweek' : `${row.matchweeksPlayed} matchweeks`
  const who = row.isYou ? `${row.displayName} (you)` : row.displayName
  return `${who}, ${rank}, ${row.points} points from ${played}`
}

function toRow(
  source: SeasonLeaderboardRow | (SeasonLeaderboardYou & { isYou: true }),
  isYou: boolean,
): StandingsRow {
  return {
    // Position, not rank: ranks repeat on a tie and would collide as keys.
    key: `row-${source.position}`,
    rankLabel: source.tied ? `=${source.rank}` : `${source.rank}`,
    rank: source.rank,
    displayName: source.displayName,
    points: source.points,
    matchweeksPlayed: source.matchweeksPlayed,
    isYou,
    accessibleSummary: summarise({ ...source, isYou }),
  }
}

/**
 * Present accumulated pages as one table.
 *
 * Takes the rows already accumulated by the caller rather than a single page,
 * because "is the player's own row already on screen" can only be answered
 * against everything loaded so far — asking it of the newest page alone would
 * re-pin a row the player can already see.
 */
export function presentStandings(
  page: SeasonLeaderboardPage,
  accumulatedRows: readonly SeasonLeaderboardRow[],
): StandingsView {
  const rows = accumulatedRows.map((row) => toRow(row, row.isYou))
  const youIsVisible = rows.some((row) => row.isYou)

  return {
    rows,
    pinnedYou:
      page.you && !youIsVisible ? toRow({ ...page.you, isYou: true }, true) : null,
    totalCount: page.totalCount,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

/** Everything the page may ask of the world. Injected, so the page stays pure. */
export type SeasonStandingsGateway = {
  load(cursor: string | null): Promise<SeasonLeaderboardPage>
}
