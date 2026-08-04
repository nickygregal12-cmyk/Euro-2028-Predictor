/**
 * Season leaderboard response parsing. Pure: no Supabase import, no network,
 * no clock — the configured wrapper is `seasonLeaderboard.ts`.
 *
 * SEPARATE FROM THE TOURNAMENT MODEL ON PURPOSE, even though the envelopes rub
 * shoulders. ADR 0011 forbids a combined cross-competition standings path, and
 * the two payloads genuinely differ: a tournament row carries `totalPoints` and
 * a rank that may be null before the standings mean anything; a season row
 * carries `points` and `matchweeksPlayed`, and its rank is never null because a
 * season table ranks from the first settled matchweek.
 *
 * MATCHES PLAYED IS NOT OPTIONAL, and that is the one field worth defending
 * here. ADR 0012 pairs it with points because "two players on 84 points from 22
 * and 23 matchweeks are not tied in meaning". A parser that quietly defaulted it
 * to zero on a malformed payload would render a plausible table in which every
 * player had played nothing, so a missing value throws rather than defaults.
 */

export type SeasonLeaderboardRow = {
  displayName: string
  points: number
  rank: number
  matchweeksPlayed: number
  tied: boolean
  position: number
  isYou: boolean
}

export type SeasonLeaderboardYou = {
  displayName: string
  points: number
  rank: number
  matchweeksPlayed: number
  tied: boolean
  position: number
}

export type SeasonLeaderboardPage = {
  rows: SeasonLeaderboardRow[]
  totalCount: number
  pageSize: number
  hasMore: boolean
  nextCursor: string | null
  you: SeasonLeaderboardYou | null
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

function mapYou(value: unknown): SeasonLeaderboardYou | null {
  // Absent `you` is ordinary: an administrator or a co-member reading a season
  // they hold no entry in cannot happen today (the RPC refuses it), but a
  // caller who has settled no matchweek is still in the table, so the only
  // legitimate null here is a payload that omitted the key.
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const displayName = stringOrNull(row.displayName)
  const points = integerOrNull(row.points)
  const rank = integerOrNull(row.rank)
  const matchweeksPlayed = integerOrNull(row.matchweeksPlayed)
  const tied = booleanOrNull(row.tied)
  const position = integerOrNull(row.position)

  if (
    !displayName ||
    points === null ||
    rank === null ||
    matchweeksPlayed === null ||
    tied === null ||
    position === null
  ) {
    return null
  }

  return { displayName, points, rank, matchweeksPlayed, tied, position }
}

function mapRow(value: unknown): SeasonLeaderboardRow | null {
  const row = objectOf(value)
  const you = mapYou(row)
  const isYou = booleanOrNull(row.isYou)
  if (you === null || isYou === null) return null
  return { ...you, isYou }
}

export function mapSeasonLeaderboardPage(value: unknown): SeasonLeaderboardPage {
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
    // A page that says there is more and offers no cursor would strand the
    // caller on page one while telling them otherwise.
    (hasMore && !nextCursor)
  ) {
    throw new Error('Season leaderboard response was malformed.')
  }

  const rows = rawRows.map(mapRow)
  if (rows.some((row) => row === null)) {
    throw new Error('Season leaderboard response contained a malformed row.')
  }

  return {
    rows: rows as SeasonLeaderboardRow[],
    totalCount,
    pageSize,
    hasMore,
    nextCursor,
    you: mapYou(payload.you),
  }
}
