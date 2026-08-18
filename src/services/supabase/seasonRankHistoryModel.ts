/**
 * One player's POSITION over a season (contract 192's
 * `get_season_rank_history`). Pure: no Supabase import, no network, no clock —
 * the wrapper is `seasonRankHistory.ts`.
 *
 * ============================ WHY THE READ EXISTS AT ALL ==================
 *
 * The RPC says it in a comment beside the field, and it is the whole reason
 * this module is not a derivation over data the browser already has:
 *
 *   > Points over time is derivable from the matchweek scores; POSITION over
 *   > time is not.
 *
 * A surface that plotted a running points total and called it a rank chart
 * would be drawing a line that is always monotonically up, in a season where
 * the player may have been overtaken every week. Rank is the server's and
 * arrives as `standing_rank`.
 *
 * ============================ RANK NEVER TRAVELS WITHOUT ITS FIELD ========
 *
 * Every point on this series carries `fieldSize`, and the RPC is explicit that
 * this is already true of every other rank surface on the platform. 4th is a
 * different fact in a field of six and a field of six thousand, so the two are
 * one value here and `rankOrNull` refuses a point that has only one of them.
 * It is the same discipline ADR 0012 applies to points and matchweeks played.
 *
 * ============================ ITS BOUNDARY IS WIDER THAN THE PROFILE'S ====
 *
 * Contract 151 needs a shared PRIVATE LEAGUE. This read needs only `compare` —
 * contract 191's weakest reachable answer — and the RPC justifies that in
 * terms: a matchweek, a cumulative total and a position are exactly what
 * `get_season_leaderboard` already shows every entrant, and NO PREDICTION
 * APPEARS IN THIS PAYLOAD AT ALL.
 *
 * So a player whose profile the caller may not open can still have a readable
 * rank history, and a surface must not assume the two permissions travel
 * together. `reach` is carried through for exactly that reason.
 *
 * ============================ IT IS ADDRESSED BY THE ENTRY, NOT THE ACCOUNT
 *
 * `playerRef` is an ENTRY id — `entries.id` for that player in that season —
 * which is contract 191's season-scoped reference. `playerId` is the account
 * id and is present only where reach is `self` or `profile`. They are two
 * different identifiers for two different purposes and this module never
 * substitutes one for the other.
 */

export type SeasonRankHistoryReach = 'self' | 'profile' | 'compare' | 'name-only'

const REACHES: readonly SeasonRankHistoryReach[] = [
  'self',
  'profile',
  'compare',
  'name-only',
]

/**
 * One settled matchweek's standing.
 *
 * `points` is that matchweek's own banked figure, not a running total — the
 * cumulative reading is the RANK, which is what the series is for.
 */
export type SeasonRankHistoryPoint = {
  matchweekId: string
  ordinal: number
  label: string
  points: number
  /** The server's standing after this matchweek. Never derived from points. */
  rank: number
  /** The field that rank was out of. Never separated from it. */
  fieldSize: number
}

export type SeasonRankHistory = {
  /** The season-scoped entry id this history belongs to. */
  playerRef: string
  reach: SeasonRankHistoryReach
  displayName: string
  /** The account id, present only where reach is `self` or `profile`. */
  playerId: string | null
  serverNow: string | null
  /** Ordered by matchweek. Empty before the first settlement — an answer. */
  matchweeks: SeasonRankHistoryPoint[]
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

/**
 * Contract 191's reach, or `null` for a value this module cannot interpret.
 *
 * An unknown STRING is a decode failure rather than a downgrade: silently
 * treating it as the weakest reach would render a player as less reachable
 * than the server said, and this read's whole boundary is that answer.
 */
function reachOrNull(value: unknown): SeasonRankHistoryReach | null {
  if (value === null || value === undefined) return null
  return REACHES.find((candidate) => candidate === value) ?? null
}

/**
 * One point, or `null` if it is not fully stated.
 *
 * A POINT IS DROPPED RATHER THAN PATCHED. A matchweek missing its rank or its
 * field size cannot be plotted honestly — a gap in a line is visible and a
 * fabricated point is not — and there is no default that would be true.
 */
function mapPoint(value: unknown): SeasonRankHistoryPoint | null {
  const row = objectOf(value)
  const matchweekId = stringOrNull(row.matchweekId)
  const ordinal = integerOrNull(row.ordinal)
  const label = stringOrNull(row.label)
  const points = integerOrNull(row.points)
  const rank = integerOrNull(row.rank)
  const fieldSize = integerOrNull(row.fieldSize)

  if (
    matchweekId === null ||
    ordinal === null ||
    label === null ||
    points === null ||
    rank === null ||
    fieldSize === null
  ) {
    return null
  }

  return { matchweekId, ordinal, label, points, rank, fieldSize }
}

export function mapSeasonRankHistory(value: unknown): SeasonRankHistory {
  const payload = objectOf(value)
  const playerRef = stringOrNull(payload.playerRef)
  const displayName = stringOrNull(payload.displayName)
  const reach = reachOrNull(payload.reach)

  if (playerRef === null || displayName === null || reach === null) {
    throw new Error('Malformed season rank history payload')
  }

  const raw = Array.isArray(payload.matchweeks) ? payload.matchweeks : []

  return {
    playerRef,
    reach,
    displayName,
    playerId: stringOrNull(payload.playerId),
    serverNow: stringOrNull(payload.server_now),
    // The RPC orders by ordinal and caps at 60; the order is preserved rather
    // than re-sorted here, so the series a surface draws is the series the
    // server sent.
    matchweeks: raw.map(mapPoint).filter((point): point is SeasonRankHistoryPoint => point !== null),
  }
}
