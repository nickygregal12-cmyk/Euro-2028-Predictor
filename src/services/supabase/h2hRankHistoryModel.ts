export const RANK_HISTORY_CHECKPOINTS = [
  { key: 'MD1', order: 1, label: 'Matchday 1' },
  { key: 'MD2', order: 2, label: 'Matchday 2' },
  { key: 'MD3', order: 3, label: 'Matchday 3' },
  { key: 'R16', order: 4, label: 'Round of 16' },
  { key: 'QF', order: 5, label: 'Quarter-finals' },
  { key: 'SF', order: 6, label: 'Semi-finals' },
  { key: 'FINAL', order: 7, label: 'Final' },
] as const

export type RankHistoryCheckpointKey = (typeof RANK_HISTORY_CHECKPOINTS)[number]['key']

export type RankHistoryPoint = {
  key: RankHistoryCheckpointKey
  order: number
  rank: number
  totalPoints: number
  capturedAt: string
}

export type H2HRankHistory = {
  you: RankHistoryPoint[]
  rival: RankHistoryPoint[]
}

const ORDER_BY_KEY = new Map<RankHistoryCheckpointKey, number>(
  RANK_HISTORY_CHECKPOINTS.map((checkpoint) => [checkpoint.key, checkpoint.order]),
)

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function mapPoints(value: unknown, side: string): RankHistoryPoint[] {
  if (!Array.isArray(value) || value.length > RANK_HISTORY_CHECKPOINTS.length) {
    throw new Error(`${side} rank history was malformed.`)
  }

  const seen = new Set<RankHistoryCheckpointKey>()
  let previousOrder = 0
  return value.map((item) => {
    const row = objectOf(item)
    const key = typeof row.key === 'string' ? (row.key as RankHistoryCheckpointKey) : null
    const expectedOrder = key ? ORDER_BY_KEY.get(key) : undefined
    const order = integer(row.order)
    const rank = integer(row.rank)
    const totalPoints = integer(row.total_points)
    const capturedAt = typeof row.captured_at === 'string' ? row.captured_at : null

    if (
      !key ||
      expectedOrder === undefined ||
      order !== expectedOrder ||
      order <= previousOrder ||
      seen.has(key) ||
      rank === null ||
      rank < 1 ||
      totalPoints === null ||
      totalPoints < 0 ||
      !capturedAt ||
      Number.isNaN(Date.parse(capturedAt))
    ) {
      throw new Error(`${side} rank history contained a malformed checkpoint.`)
    }

    seen.add(key)
    previousOrder = order
    return { key, order, rank, totalPoints, capturedAt }
  })
}

export function mapH2HRankHistory(value: unknown): H2HRankHistory {
  const payload = objectOf(value)
  return {
    you: mapPoints(payload.you, 'Your'),
    rival: mapPoints(payload.rival, 'Rival'),
  }
}
