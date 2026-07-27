export type LeagueMember = {
  userId: string
  displayName: string
  totalPoints: number
  rank: number | null
  tied: boolean
  position: number
  isYou: boolean
  isOwner: boolean
  hasEntry: boolean
  predictedCount: number
  joinedAt: string
}

export type LeagueMemberYou = Omit<LeagueMember, 'isYou'>

export type LeagueMemberPage = {
  rows: LeagueMember[]
  totalCount: number
  pageSize: number
  hasMore: boolean
  nextCursor: string | null
  you: LeagueMemberYou | null
}

export type TransferCandidate = {
  userId: string
  displayName: string
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
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
  return rank === null || rank < 1 ? undefined : rank
}

function mapMember(value: unknown): LeagueMember | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.userId)
  const displayName = stringOrNull(row.displayName)
  const totalPoints = integerOrNull(row.totalPoints)
  const rank = nullableRank(row.rank)
  const tied = booleanOrNull(row.tied)
  const position = integerOrNull(row.position)
  const isYou = booleanOrNull(row.isYou)
  const isOwner = booleanOrNull(row.isOwner)
  const hasEntry = booleanOrNull(row.hasEntry)
  const predictedCount = integerOrNull(row.predictedCount)
  const joinedAt = stringOrNull(row.joinedAt)

  if (
    !userId ||
    !displayName ||
    totalPoints === null ||
    rank === undefined ||
    tied === null ||
    position === null ||
    position < 1 ||
    isYou === null ||
    isOwner === null ||
    hasEntry === null ||
    predictedCount === null ||
    predictedCount < 0 ||
    !joinedAt
  ) {
    return null
  }

  return {
    userId,
    displayName,
    totalPoints,
    rank,
    tied,
    position,
    isYou,
    isOwner,
    hasEntry,
    predictedCount,
    joinedAt,
  }
}

function mapYou(value: unknown): LeagueMemberYou | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const mapped = mapMember({ ...row, isYou: true })
  if (!mapped) return null
  return {
    userId: mapped.userId,
    displayName: mapped.displayName,
    totalPoints: mapped.totalPoints,
    rank: mapped.rank,
    tied: mapped.tied,
    position: mapped.position,
    isOwner: mapped.isOwner,
    hasEntry: mapped.hasEntry,
    predictedCount: mapped.predictedCount,
    joinedAt: mapped.joinedAt,
  }
}

export function mapLeagueMemberPage(value: unknown): LeagueMemberPage {
  const payload = objectOf(value)
  const totalCount = integerOrNull(payload.totalCount)
  const pageSize = integerOrNull(payload.pageSize)
  const hasMore = booleanOrNull(payload.hasMore)
  const nextCursor =
    payload.nextCursor === null ? null : stringOrNull(payload.nextCursor)
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
    throw new Error('League standings response was malformed.')
  }

  const rows = rawRows.map(mapMember)
  if (rows.some((row) => row === null)) {
    throw new Error('League standings response contained a malformed row.')
  }

  const you = mapYou(payload.you)
  if (payload.you !== null && payload.you !== undefined && you === null) {
    throw new Error('League standings response contained malformed caller context.')
  }

  return {
    rows: rows as LeagueMember[],
    totalCount,
    pageSize,
    hasMore,
    nextCursor,
    you,
  }
}

export function mapTransferCandidates(value: unknown): TransferCandidate[] {
  if (!Array.isArray(value)) {
    throw new Error('Transfer candidate response was malformed.')
  }

  const candidates = value.map((candidate) => {
    const row = objectOf(candidate)
    const userId = stringOrNull(row.user_id)
    const displayName = stringOrNull(row.display_name)
    return userId && displayName ? { userId, displayName } : null
  })

  if (candidates.some((candidate) => candidate === null)) {
    throw new Error('Transfer candidate response contained a malformed row.')
  }

  return candidates as TransferCandidate[]
}
