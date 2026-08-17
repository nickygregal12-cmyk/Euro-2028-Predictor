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
 *
 * IDENTITY IS THE SERVER'S ANSWER, NEVER THIS MODULE'S — contract 191. A row
 * carries a season-scoped `playerRef`, a `reach` the server decided, and a
 * `playerId` only where a profile will actually answer. This module must never
 * derive any of the three: matching players by display name is the defect the
 * reference exists to make impossible, and inferring `reach` from the presence
 * of `playerId` would put a permission rule in the browser.
 *
 * A PAYLOAD WITHOUT THEM IS A DATABASE BELOW CONTRACT 191, not a malformed one.
 * It decodes to the state that database is genuinely in — no reference, and a
 * reach of `name-only` — which is exactly how the surface behaved before the
 * contract existed. An UNRECOGNISED `reach` is a different matter and throws:
 * a value this module cannot interpret must never be rendered as "not
 * reachable", because that is indistinguishable from a permission being denied.
 */

/**
 * What the server says this caller may do with this player, in this season.
 *
 *   `self`       — the caller.
 *   `profile`    — a private-league co-member on this season (contract 151).
 *   `compare`    — a same-season entrant, comparable after a matchweek locks
 *                  (contract 129), and NOT profile-readable.
 *   `name-only`  — no address. Only ever the answer from a database below
 *                  contract 191; every row of a season table is at least
 *                  `compare` once the contract is applied.
 */
export type SeasonPlayerReach = 'self' | 'profile' | 'compare' | 'name-only'

const REACHES: readonly SeasonPlayerReach[] = ['self', 'profile', 'compare', 'name-only']

export type SeasonLeaderboardRow = {
  displayName: string
  points: number
  rank: number
  matchweeksPlayed: number
  tied: boolean
  position: number
  isYou: boolean
  playerRef: string | null
  reach: SeasonPlayerReach
  playerId: string | null
}

export type SeasonLeaderboardYou = {
  displayName: string
  points: number
  rank: number
  matchweeksPlayed: number
  tied: boolean
  position: number
  playerRef: string | null
  reach: SeasonPlayerReach
  playerId: string | null
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

/**
 * Contract 191's reach, or `null` for a value this module cannot interpret.
 *
 * An ABSENT key is the pre-191 database and answers `name-only`; an unknown
 * STRING is a payload from a contract this build does not understand and is a
 * decode failure, because silently downgrading it would render a player as
 * unreachable when the server may have said otherwise.
 */
function reachOrNull(value: unknown): SeasonPlayerReach | null {
  if (value === null || value === undefined) return 'name-only'
  return REACHES.find((candidate) => candidate === value) ?? null
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
  const reach = reachOrNull(row.reach)

  if (
    !displayName ||
    points === null ||
    rank === null ||
    matchweeksPlayed === null ||
    tied === null ||
    position === null ||
    reach === null
  ) {
    return null
  }

  return {
    displayName,
    points,
    rank,
    matchweeksPlayed,
    tied,
    position,
    playerRef: stringOrNull(row.playerRef),
    reach,
    // Read, never inferred. The server withholds this on a `compare` row, and
    // a browser that reconstructed it from anywhere else would be addressing a
    // player the server declined to address.
    playerId: stringOrNull(row.playerId),
  }
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
