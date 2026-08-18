/**
 * TWO PLAYERS COMPARED ACROSS A SEASON, IN ONE READ (contract 192's
 * `get_season_rivalry`). Pure: no Supabase import, no network, no clock — the
 * wrapper is `seasonRivalry.ts`.
 *
 * ============================ WHY NOT CONTRACT 129 ========================
 *
 * `get_season_head_to_head` is per-MATCHWEEK: one call answers one matchweek.
 * A season comparison assembled from it would be one RPC per matchweek, which
 * the Stage 10 completion predicate forbids in terms. This read is the bounded
 * season-wide answer; contract 129 remains the drill-down into a single
 * matchweek's fixtures.
 *
 * ============================ THE DENOMINATOR IS STATED, NOT COUNTED ======
 *
 * `matchweeksCompared` arrives as its own figure and `recent` is TRUNCATED by
 * the server's `p_recent` bound. Counting a record off `recent` would report
 * "3-1" from the last five matchweeks of a thirty-matchweek rivalry. The RPC
 * says it plainly: a record without its denominator is the misleading half.
 *
 * A ZERO DENOMINATOR IS AN ANSWER, NOT A ZERO. Where no matchweek has settled,
 * revealed and banked for both players, `matchweeksCompared` is 0 and every
 * count beside it is 0 — and 0-0-0 out of nothing is "not yet comparable",
 * never "level". Nothing here may divide by it; `rivalryComparable` exists so
 * a surface asks rather than infers.
 *
 * ============================ BOTH SIDES ARE MEASURED THE SAME WAY ========
 *
 * The RPC computes accuracy over the COMPARED matchweeks only and identically
 * for both players, so the two columns are comparable by construction. That
 * property is the server's; this module carries it and never recomputes a
 * count, a rate or a ranking from the parts.
 *
 * ============================ RANK STILL NEVER TRAVELS ALONE ==============
 *
 * A side's standing is a rank AND the field it is out of, or it is absent — a
 * player holding no banked standing yet has `standing: null` rather than a
 * rank of zero. Same discipline as `seasonRankHistoryModel`, and ADR 0012's.
 *
 * ============================ THE SIGN IS THE SERVER'S ====================
 *
 * `pointsGap` is positive when the OPPONENT is ahead. It is carried unflipped,
 * because a caller that re-signs it is a second authority on which way round
 * the comparison reads.
 */

/** Contract 129's refusal, reused: one fact, one class. */
export { OpponentNotEnteredError } from './seasonHeadToHeadModel'

/**
 * Contract 191 said `none`: this caller may not compare with this player.
 *
 * A state, not an error. It is about PERMISSION and is answered by telling the
 * player so — never by rendering an empty comparison, which reads as "you are
 * both on nothing".
 */
export class RivalryNotPermittedError extends Error {
  constructor() {
    super('You may not compare with that player')
    this.name = 'RivalryNotPermittedError'
  }
}

export type SeasonRivalryReach = 'self' | 'profile' | 'compare' | 'name-only'

const REACHES: readonly SeasonRivalryReach[] = ['self', 'profile', 'compare', 'name-only']

/** A rank and the field it is out of. Never one without the other. */
type SeasonRivalryStanding = {
  rank: number
  fieldSize: number
}

/**
 * Counts over the compared matchweeks. Facts about predictions, not points:
 * no point value appears here and nothing may turn one into points.
 */
type SeasonRivalryAccuracy = {
  fixturesCompared: number
  exactScores: number
  correctOutcomes: number
}

export type SeasonRivalrySide = {
  /** The season-scoped entry id (contract 191's `playerRef`). */
  playerRef: string
  displayName: string
  reach: SeasonRivalryReach
  /** The account id, present only where reach is `self` or `profile`. */
  playerId: string | null
  points: number
  matchweeksPlayed: number
  /** Null where the player holds no banked standing. Never half-stated. */
  standing: SeasonRivalryStanding | null
  accuracy: SeasonRivalryAccuracy
}

type SeasonRivalryOutcome = 'you' | 'them' | 'level'

type SeasonRivalryMatchweek = {
  matchweekId: string
  ordinal: number
  label: string
  yourPoints: number
  theirPoints: number
  /** The server's verdict for the matchweek, not a comparison done here. */
  outcome: SeasonRivalryOutcome
}

type SeasonRivalryRecord = {
  yourWins: number
  theirWins: number
  draws: number
}

export type SeasonRivalry = {
  serverNow: string | null
  /**
   * Matchweeks settled, revealed and banked BY BOTH — the denominator for the
   * record and for both accuracy columns. `recent` is a truncated window on
   * this, never a substitute for it.
   */
  matchweeksCompared: number
  you: SeasonRivalrySide
  opponent: SeasonRivalrySide
  /** Positive means the OPPONENT is ahead. The server's sign, unflipped. */
  pointsGap: number
  record: SeasonRivalryRecord
  /** Most recent first, bounded by the server at 1..20. */
  recent: readonly SeasonRivalryMatchweek[]
}

/**
 * Whether the two players have anything comparable yet.
 *
 * Exists so a surface ASKS instead of reading 0-0-0 as a drawn rivalry, and so
 * no caller divides by a denominator that may be zero.
 */
export function rivalryComparable(rivalry: SeasonRivalry): boolean {
  return rivalry.matchweeksCompared > 0
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
 * A count, or zero.
 *
 * Safe ONLY for the tallies the RPC itself coalesces to zero (`count(*)
 * filter`, `coalesce(..., 0)`), where absent and zero are the same fact.
 * Deliberately not used for rank, field size or a points figure that can be
 * genuinely unknown.
 */
function countOf(value: unknown): number {
  return integerOrNull(value) ?? 0
}

function reachOrNull(value: unknown): SeasonRivalryReach | null {
  if (value === null || value === undefined) return null
  return REACHES.find((candidate) => candidate === value) ?? null
}

/**
 * A standing, or `null`.
 *
 * The RPC left-joins the season standings, so a player with no banked standing
 * sends both fields null. A payload stating one without the other is not a
 * partial standing to be patched — it is not a standing.
 */
function standingOf(row: Record<string, unknown>): SeasonRivalryStanding | null {
  const rank = integerOrNull(row.rank)
  const fieldSize = integerOrNull(row.fieldSize)
  if (rank === null || fieldSize === null) return null
  return { rank, fieldSize }
}

function mapSide(value: unknown, which: string): SeasonRivalrySide {
  const row = objectOf(value)
  const playerRef = stringOrNull(row.playerRef)
  const displayName = stringOrNull(row.displayName)
  const reach = reachOrNull(row.reach)

  // A side with no reference, no name or a reach this build cannot interpret
  // is not a side. Rendering it as an unnamed column would put a comparison on
  // screen against nobody in particular.
  if (playerRef === null || displayName === null || reach === null) {
    throw new Error(`Malformed rivalry ${which}`)
  }

  return {
    playerRef,
    displayName,
    reach,
    playerId: stringOrNull(row.playerId),
    points: countOf(row.points),
    matchweeksPlayed: countOf(row.matchweeksPlayed),
    standing: standingOf(row),
    accuracy: {
      fixturesCompared: countOf(row.fixturesCompared),
      exactScores: countOf(row.exactScores),
      correctOutcomes: countOf(row.correctOutcomes),
    },
  }
}

function outcomeOrNull(value: unknown): SeasonRivalryOutcome | null {
  return value === 'you' || value === 'them' || value === 'level' ? value : null
}

/**
 * One compared matchweek, or `null` if it is not fully stated.
 *
 * Dropped rather than patched, and cheaply so: the record and the denominator
 * are stated separately, so a missing window row costs a row of the window and
 * never the rivalry's arithmetic.
 *
 * The outcome is NOT recomputed from the two point figures when it is missing.
 * The server decides what a matchweek was; a second rule here would agree
 * until the day the scoring changed underneath it.
 */
function mapMatchweek(value: unknown): SeasonRivalryMatchweek | null {
  const row = objectOf(value)
  const matchweekId = stringOrNull(row.matchweekId)
  const ordinal = integerOrNull(row.ordinal)
  const label = stringOrNull(row.label)
  const yourPoints = integerOrNull(row.yourPoints)
  const theirPoints = integerOrNull(row.theirPoints)
  const outcome = outcomeOrNull(row.outcome)

  if (
    matchweekId === null ||
    ordinal === null ||
    label === null ||
    yourPoints === null ||
    theirPoints === null ||
    outcome === null
  ) {
    return null
  }

  return { matchweekId, ordinal, label, yourPoints, theirPoints, outcome }
}

export function mapSeasonRivalry(value: unknown): SeasonRivalry {
  const payload = objectOf(value)
  const record = objectOf(payload.record)
  const raw = Array.isArray(payload.recent) ? payload.recent : []

  return {
    serverNow: stringOrNull(payload.server_now),
    matchweeksCompared: countOf(payload.matchweeksCompared),
    you: mapSide(payload.you, 'you'),
    opponent: mapSide(payload.opponent, 'opponent'),
    pointsGap: integerOrNull(payload.pointsGap) ?? 0,
    record: {
      yourWins: countOf(record.yourWins),
      theirWins: countOf(record.theirWins),
      draws: countOf(record.draws),
    },
    // The RPC orders by ordinal descending and caps at `p_recent`; the order is
    // preserved rather than re-sorted, so the window a surface draws is the
    // window the server sent.
    recent: raw
      .map(mapMatchweek)
      .filter((entry): entry is SeasonRivalryMatchweek => entry !== null),
  }
}
