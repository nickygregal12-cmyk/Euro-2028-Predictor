export type LeaderboardRow = {
  displayName: string
  totalPoints: number
  rank: number | null
  tied: boolean
  position: number
  isYou: boolean
}

export type LeaderboardYou = {
  displayName: string
  totalPoints: number
  rank: number | null
  tied: boolean
  position: number
}

export type LeaderboardPage = {
  rows: LeaderboardRow[]
  totalCount: number
  pageSize: number
  hasMore: boolean
  nextCursor: string | null
  you: LeaderboardYou | null
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

function nullableRank(value: unknown): number | null | undefined {
  if (value === null) return null
  const rank = integerOrNull(value)
  return rank === null ? undefined : rank
}

function mapRow(value: unknown): LeaderboardRow | null {
  const row = objectOf(value)
  const displayName = stringOrNull(row.displayName)
  const totalPoints = integerOrNull(row.totalPoints)
  const rank = nullableRank(row.rank)
  const tied = booleanOrNull(row.tied)
  const position = integerOrNull(row.position)
  const isYou = booleanOrNull(row.isYou)

  if (
    !displayName ||
    totalPoints === null ||
    rank === undefined ||
    tied === null ||
    position === null ||
    isYou === null
  ) {
    return null
  }

  return { displayName, totalPoints, rank, tied, position, isYou }
}

function mapYou(value: unknown): LeaderboardYou | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const displayName = stringOrNull(row.displayName)
  const totalPoints = integerOrNull(row.totalPoints)
  const rank = nullableRank(row.rank)
  const tied = booleanOrNull(row.tied)
  const position = integerOrNull(row.position)

  if (
    !displayName ||
    totalPoints === null ||
    rank === undefined ||
    tied === null ||
    position === null
  ) {
    return null
  }

  return { displayName, totalPoints, rank, tied, position }
}

export function mapLeaderboardPage(value: unknown): LeaderboardPage {
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
    (hasMore && !nextCursor)
  ) {
    throw new Error('Leaderboard response was malformed.')
  }

  const rows = rawRows.map(mapRow)
  if (rows.some((row) => row === null)) {
    throw new Error('Leaderboard response contained a malformed row.')
  }

  return {
    rows: rows as LeaderboardRow[],
    totalCount,
    pageSize,
    hasMore,
    nextCursor,
    you: mapYou(payload.you),
  }
}
