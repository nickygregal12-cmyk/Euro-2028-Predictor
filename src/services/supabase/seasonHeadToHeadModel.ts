/**
 * Season head-to-head parsing (contract 129's `get_season_head_to_head`). Pure:
 * no Supabase import, no network, no clock — the wrapper is
 * `seasonHeadToHead.ts`.
 *
 * ITS REVEAL BOUNDARY IS THE MATCHWEEK'S OWN LOCK, not the one tournament
 * instant a season does not have, and the read HIDES when a round's kickoffs
 * are incomplete rather than revealing. Nothing in this file decides that; the
 * read raises and the wrapper turns the raise into a state. What matters here
 * is that the two sides arrive already comparable, so no caller has to work out
 * who is who.
 *
 * A NULL POINTS FIGURE IS NOT ZERO. `season_matchweek_scores` distinguishes "no
 * settled matchweek" from "settled at nothing", and so does this: a matchweek
 * that has not settled reports null, and a surface that rendered it as 0 would
 * be inventing a result for both players.
 */

/** Raised by the read before the matchweek locks. A rule, not a fault. */
export class HeadToHeadHiddenError extends Error {
  constructor() {
    super('Other players’ predictions are hidden until the matchweek locks')
    this.name = 'HeadToHeadHiddenError'
  }
}

/** Raised when the opponent holds no entry in this season. */
export class OpponentNotEnteredError extends Error {
  constructor() {
    super('That player has not entered this season')
    this.name = 'OpponentNotEnteredError'
  }
}

export type HeadToHeadSide = {
  userId: string | null
  displayName: string | null
  /** Null until the matchweek settles. Never rendered as zero. */
  points: number | null
  joker: boolean
  predicted: number
  seasonPoints: number
}

export type HeadToHeadFixture = {
  id: string
  homeName: string
  awayName: string
  kickoffAt: string | null
  status: string
  resultHome: number | null
  resultAway: number | null
  yours: { home: number; away: number } | null
  theirs: { home: number; away: number } | null
}

export type SeasonHeadToHead = {
  matchweek: number
  lockedAt: string | null
  you: HeadToHeadSide
  opponent: HeadToHeadSide
  fixtures: readonly HeadToHeadFixture[]
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function mapScoreline(value: unknown): { home: number; away: number } | null {
  const row = objectOf(value)
  const home = integerOrNull(row.home)
  const away = integerOrNull(row.away)
  // A half-prediction is not a prediction. One side without the other means the
  // payload disagrees with itself and neither number is shown.
  return home !== null && away !== null ? { home, away } : null
}

function mapSide(value: unknown): HeadToHeadSide {
  const row = objectOf(value)
  return {
    userId: stringOrNull(row.user_id),
    displayName: stringOrNull(row.display_name),
    points: integerOrNull(row.points),
    joker: row.joker === true,
    predicted: integerOrNull(row.predicted) ?? 0,
    seasonPoints: integerOrNull(row.season_points) ?? 0,
  }
}

function mapFixture(value: unknown): HeadToHeadFixture | null {
  const row = objectOf(value)
  const id = stringOrNull(row.id)
  const homeName = stringOrNull(row.home_name)
  const awayName = stringOrNull(row.away_name)
  const status = stringOrNull(row.status)
  if (!id || !homeName || !awayName || !status) return null

  const resultHome = integerOrNull(row.result_home)
  const resultAway = integerOrNull(row.result_away)
  const complete = resultHome !== null && resultAway !== null

  return {
    id,
    homeName,
    awayName,
    kickoffAt: stringOrNull(row.kickoff_at),
    status,
    resultHome: complete ? resultHome : null,
    resultAway: complete ? resultAway : null,
    yours: mapScoreline(row.your_prediction),
    theirs: mapScoreline(row.their_prediction),
  }
}

export function mapSeasonHeadToHead(value: unknown): SeasonHeadToHead {
  const payload = objectOf(value)
  const matchweek = integerOrNull(payload.matchweek)
  if (matchweek === null) {
    throw new Error('The season head-to-head response was not in the expected shape.')
  }

  const raw = Array.isArray(payload.fixtures) ? payload.fixtures : []

  return {
    matchweek,
    lockedAt: stringOrNull(payload.locked_at),
    you: mapSide(payload.you),
    opponent: mapSide(payload.opponent),
    fixtures: raw
      .map(mapFixture)
      .filter((fixture): fixture is HeadToHeadFixture => fixture !== null),
  }
}
