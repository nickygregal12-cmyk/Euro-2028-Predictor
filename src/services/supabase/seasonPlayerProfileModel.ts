/**
 * One player's season, and what they predicted (contract 151, `MIG-UI-02`).
 *
 * THE DISCLOSURE BOUNDARY IS THE SERVER'S. Identity is visible to
 * private-league co-members and nobody else — sharing a competition is not
 * enough, because a season may have fifty thousand entrants and none of them
 * agreed to be looked up, whereas sharing a private league is a mutual act. A
 * caller who shares no league is REFUSED, and that refusal must reach the
 * player as "you do not share a private league with this player" rather than as
 * an empty profile.
 *
 * PREDICTION DETAIL ONLY AFTER THAT MATCHWEEK'S OWN LOCK — the boundary
 * contract 149 established. A player always sees their own history including
 * unlocked matchweeks, because those are their own picks.
 *
 * THERE IS NO PLAYER DIRECTORY, and this module must never become the seam for
 * one. It answers about ONE named player and cannot enumerate, search or rank
 * the population; a caller needs both a season and a player id it already has
 * from a league table or a Match Centre.
 *
 * POINTS ARE NEVER RECOMPUTED — they come from the same banked authorities the
 * season and the leagues use. The exact-score and correct-outcome counts ARE
 * derived by the RPC, over settled matchweeks only, and are facts about
 * predictions rather than a second scoring authority: no point value appears in
 * them, and nothing here may turn one into points.
 */

export type SeasonProfilePlayer = {
  userId: string
  displayName: string
  isSelf: boolean
}

export type SeasonProfileSeason = {
  points: number
  matchweeksPlayed: number
  rank: number
  fieldSize: number
}

export type SeasonProfileAccuracy = {
  fixturesPredicted: number
  exactScores: number
  correctOutcomes: number
}

export type SeasonProfileJokers = {
  played: number
  pointsFromJokerMatchweeks: number
}

export type SeasonProfileMatchweek = {
  matchweekId: string
  ordinal: number
  label: string
  /** Null until the matchweek settles. */
  points: number | null
  jokerPlayed: boolean
  /** Keyed by season fixture id. */
  predictions: Readonly<Record<string, { home: number; away: number }>>
}

export type SeasonPlayerProfile = {
  player: SeasonProfilePlayer
  /** False for a co-member who never entered this season's game. Not an error. */
  entered: boolean
  serverNow: string | null
  /** Null when the player has not entered, or has no banked standing yet. */
  season: SeasonProfileSeason | null
  accuracy: SeasonProfileAccuracy | null
  jokers: SeasonProfileJokers | null
  /** Most recent first. Bounded by the server at forty matchweeks. */
  history: readonly SeasonProfileMatchweek[]
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
 * `count(*)` arrives as a number, and `sum()` as a number or a numeric string
 * depending on the driver. Accepting both is a decoder's job; converting a
 * string that is not a whole number is not.
 */
function countOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value)
  return null
}

function mapSeason(value: unknown): SeasonProfileSeason | null {
  const row = objectOf(value)
  const points = countOrNull(row.points)
  const matchweeksPlayed = countOrNull(row.matchweeks_played)
  const rank = integerOrNull(row.rank)
  const fieldSize = integerOrNull(row.field_size)
  if (points === null || matchweeksPlayed === null || rank === null || fieldSize === null) {
    return null
  }
  return { points, matchweeksPlayed, rank, fieldSize }
}

function mapAccuracy(value: unknown): SeasonProfileAccuracy | null {
  const row = objectOf(value)
  const fixturesPredicted = countOrNull(row.fixtures_predicted)
  const exactScores = countOrNull(row.exact_scores)
  const correctOutcomes = countOrNull(row.correct_outcomes)
  if (fixturesPredicted === null || exactScores === null || correctOutcomes === null) {
    return null
  }
  return { fixturesPredicted, exactScores, correctOutcomes }
}

function mapJokers(value: unknown): SeasonProfileJokers | null {
  const row = objectOf(value)
  const played = countOrNull(row.played)
  const points = countOrNull(row.points_from_joker_matchweeks)
  if (played === null || points === null) return null
  return { played, pointsFromJokerMatchweeks: points }
}

function mapPredictions(value: unknown): Record<string, { home: number; away: number }> {
  const row = objectOf(value)
  const predictions: Record<string, { home: number; away: number }> = {}
  for (const [fixtureId, prediction] of Object.entries(row)) {
    const score = objectOf(prediction)
    const home = integerOrNull(score.home)
    const away = integerOrNull(score.away)
    if (home !== null && away !== null) predictions[fixtureId] = { home, away }
  }
  return predictions
}

function mapMatchweek(value: unknown): SeasonProfileMatchweek | null {
  const row = objectOf(value)
  const matchweekId = stringOrNull(row.matchweek_id)
  const ordinal = integerOrNull(row.ordinal)
  const label = stringOrNull(row.label)
  if (!matchweekId || ordinal === null || !label) return null

  return {
    matchweekId,
    ordinal,
    label,
    points: countOrNull(row.points),
    jokerPlayed: row.joker_played === true,
    predictions: mapPredictions(row.predictions),
  }
}

/** Pure decoder, exported so the entered/not-entered states are testable. */
export function mapSeasonPlayerProfile(value: unknown): SeasonPlayerProfile {
  const payload = objectOf(value)
  const player = objectOf(payload.player)
  const userId = stringOrNull(player.user_id)
  const displayName = stringOrNull(player.display_name)

  if (!userId || !displayName) {
    throw new Error('The season player profile response was not in the expected shape.')
  }

  const rawHistory = Array.isArray(payload.history) ? payload.history : []

  return {
    player: { userId, displayName, isSelf: player.is_self === true },
    entered: payload.entered === true,
    serverNow: stringOrNull(payload.server_now),
    season: mapSeason(payload.season),
    accuracy: mapAccuracy(payload.accuracy),
    jokers: mapJokers(payload.jokers),
    history: rawHistory
      .map(mapMatchweek)
      .filter((matchweek): matchweek is SeasonProfileMatchweek => matchweek !== null),
  }
}
