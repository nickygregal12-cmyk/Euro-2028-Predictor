/**
 * Season private-league standings response parsing. Pure: no Supabase import,
 * no network, no clock — the configured wrapper is `seasonLeagueStandings.ts`.
 *
 * WHY THIS IS NOT THE SEASON LEADERBOARD MODEL, even though the envelopes are
 * near-identical. Contract 128 gave a season league a table of its own because
 * a private league is its own table: the totals come from `season_standings`
 * so a league cannot disagree with the season, but the RANK is recomputed
 * inside the league. Two rows carrying the same `points` therefore carry
 * different ranks in the two payloads, and a shared parser would invite a
 * shared presenter, which is how a competition-wide ranking gets asserted by
 * accident. ADR 0011 keeps each table its own.
 *
 * TWO FIELDS EXIST HERE THAT THE SEASON LEADERBOARD HAS NO USE FOR, and both
 * are load-bearing rather than decoration. `hasEntry` is false for a league
 * member who joined the league and never entered the game — `get_season_
 * league_standings` includes them deliberately, because the alternative hides
 * a league from the person who created it — and a row showing them on zero
 * points beside players who have actually played would be a lie of omission.
 * `isOwner` is what lets the surface name the owner without a second read.
 *
 * MATCHWEEKS PLAYED IS NOT OPTIONAL, for the same reason it is not optional on
 * the season leaderboard: ADR 0012 pairs it with points, and a parser that
 * defaulted it to zero would render a plausible table in which nobody had
 * played anything. A missing value throws.
 */

export type SeasonLeagueStandingsRow = {
  /**
   * The member's account id, which the read has always sent and this decoder
   * used to drop.
   *
   * IT IS WHY CONTRACT 129 HAD NO CALLER. `get_season_head_to_head` is
   * addressed by an opponent's user id, and the public season leaderboard
   * exposes none — only display names. This read is the single browser surface
   * that carries one, so discarding it left a granted head-to-head with no way
   * to name an opponent from anywhere in the product.
   */
  userId: string
  displayName: string
  points: number
  /** Recomputed within the league by the server. Never derived here. */
  rank: number
  matchweeksPlayed: number
  tied: boolean
  position: number
  isYou: boolean
  isOwner: boolean
  /** False for a league member holding no entry in the game the league ranks. */
  hasEntry: boolean
}

export type SeasonLeagueStandingsYou = Omit<SeasonLeagueStandingsRow, 'isYou'>

export type SeasonLeagueStandingsPage = {
  rows: SeasonLeagueStandingsRow[]
  totalCount: number
  pageSize: number
  hasMore: boolean
  nextCursor: string | null
  /** The caller's own row, whichever page they asked for. */
  you: SeasonLeagueStandingsYou | null
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function mapYou(value: unknown): SeasonLeagueStandingsYou | null {
  // An absent `you` is ordinary rather than malformed: league membership is the
  // read's boundary, so every caller who reaches it is in the table — but the
  // key is still allowed to be null, and a null must not be read as a zero row.
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const userId = stringOrNull(row.userId)
  const displayName = stringOrNull(row.displayName)
  const points = integerOrNull(row.points)
  const rank = integerOrNull(row.rank)
  const matchweeksPlayed = integerOrNull(row.matchweeksPlayed)
  const tied = booleanOrNull(row.tied)
  const position = integerOrNull(row.position)
  const isOwner = booleanOrNull(row.isOwner)
  const hasEntry = booleanOrNull(row.hasEntry)

  if (
    !userId ||
    !displayName ||
    points === null ||
    rank === null ||
    matchweeksPlayed === null ||
    tied === null ||
    position === null ||
    isOwner === null ||
    hasEntry === null
  ) {
    return null
  }

  return {
    userId,
    displayName,
    points,
    rank,
    matchweeksPlayed,
    tied,
    position,
    isOwner,
    hasEntry,
  }
}

function mapRow(value: unknown): SeasonLeagueStandingsRow | null {
  const row = objectOf(value)
  const you = mapYou(row)
  const isYou = booleanOrNull(row.isYou)
  if (you === null || isYou === null) return null
  return { ...you, isYou }
}

export function mapSeasonLeagueStandingsPage(value: unknown): SeasonLeagueStandingsPage {
  const payload = objectOf(value)
  const totalCount = integerOrNull(payload.totalCount)
  const pageSize = integerOrNull(payload.pageSize)
  const hasMore = booleanOrNull(payload.hasMore)
  const nextCursor = stringOrNull(payload.nextCursor)
  const rawRows = Array.isArray(payload.rows) ? payload.rows : null

  if (
    totalCount === null ||
    totalCount < 0 ||
    pageSize === null ||
    pageSize < 1 ||
    hasMore === null ||
    rawRows === null ||
    // A page claiming more rows and offering no cursor strands the caller on
    // page one while telling them otherwise.
    (hasMore && !nextCursor)
  ) {
    throw new Error('League standings response was malformed.')
  }

  const rows = rawRows.map(mapRow)
  if (rows.some((row) => row === null)) {
    throw new Error('League standings response contained a malformed row.')
  }

  return {
    rows: rows as SeasonLeagueStandingsRow[],
    totalCount,
    pageSize,
    hasMore,
    nextCursor,
    you: mapYou(payload.you),
  }
}
