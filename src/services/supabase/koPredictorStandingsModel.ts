// Pure response parsing for the KO Predictor standings read (contract 52).

export type KoStandingRow = {
  userId: string
  displayName: string
  rank: number
  totalPoints: number
  exactCount: number
  resultCount: number
  throughCount: number
  matchesScored: number
}

export type KoStandingsSummary = Omit<KoStandingRow, 'userId' | 'displayName'>

export type KoStandingsRead = {
  serverNow: string
  competitionId: string
  standings: KoStandingRow[]
  /** The caller's own context; null when they have not entered. */
  me: KoStandingsSummary | null
  /** Pass back to fetch the next page; null when the field is exhausted. */
  nextCursor: string | null
}

function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('KO standings returned an invalid record.')
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`KO standings returned an invalid ${field}.`)
  }
  return value
}

function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`KO standings returned an invalid ${field}.`)
  }
  return value
}

function summaryOf(row: Record<string, unknown>): KoStandingsSummary {
  return {
    rank: count(row.rank, 'rank'),
    totalPoints: count(row.total_points, 'points total'),
    exactCount: count(row.exact_count, 'exact count'),
    resultCount: count(row.result_count, 'result count'),
    throughCount: count(row.through_count, 'through count'),
    matchesScored: count(row.matches_scored, 'scored-match count'),
  }
}

export function mapKoStandingsResponse(value: unknown): KoStandingsRead {
  const root = recordOf(value)

  const serverNow = text(root.server_now, 'server time')
  if (Number.isNaN(new Date(serverNow).getTime())) {
    throw new Error('KO standings returned an invalid server time.')
  }

  if (!Array.isArray(root.standings)) {
    throw new Error('KO standings returned an invalid standings list.')
  }

  const standings = root.standings.map((entry): KoStandingRow => {
    const row = recordOf(entry)
    return {
      userId: text(row.user_id, 'user id'),
      displayName: text(row.display_name, 'display name'),
      ...summaryOf(row),
    }
  })

  const me =
    root.me === null || root.me === undefined ? null : summaryOf(recordOf(root.me))

  const nextCursor =
    root.next_cursor === null || root.next_cursor === undefined
      ? null
      : text(root.next_cursor, 'cursor')

  return {
    serverNow,
    competitionId: text(root.competition_id, 'competition id'),
    standings,
    me,
    nextCursor,
  }
}
