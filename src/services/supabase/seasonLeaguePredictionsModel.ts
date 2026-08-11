/**
 * What a private league predicted, once the matchweek has locked (contract 149,
 * `MIG-UI-01`).
 *
 * THE REVEAL BOUNDARY IS THE SERVER'S AND ONLY THE SERVER'S. The RPC resolves
 * the matchweek's own lock from `season_matchweek_lock_at` and takes no time
 * argument at all, so there is nothing for this module to pass and nothing for
 * a caller to influence. `revealed` is the answer, not a hint.
 *
 * BEFORE THE LOCK IT HIDES RATHER THAN REFUSES, and hides completely: no member
 * rows, not even redacted ones, and `predictedCount` is zero rather than a leak
 * of who has played. A refusal would be indistinguishable from "you may not see
 * this league", which is a different sentence to show a player.
 *
 * MEMBERSHIP IS THE BOUNDARY, not game entry — the choice contract 128 made for
 * the league table, kept here so the two agree. A member who entered nothing
 * comes back with no predictions rather than being dropped from their own
 * league.
 *
 * POINTS ARE NEVER RECOMPUTED. They come from `season_matchweek_scores` and are
 * null until the matchweek settles; absent points and zero points are different
 * answers and every surface below must keep them apart.
 */

export type SeasonLeaguePrediction = {
  home: number
  away: number
}

export type SeasonLeaguePredictionMember = {
  userId: string
  displayName: string
  isSelf: boolean
  /** Null until the matchweek settles. Never zero standing in for unknown. */
  points: number | null
  settledAt: string | null
  jokerPlayed: boolean
  /** Keyed by season fixture id. Empty for a member who did not predict. */
  predictions: Readonly<Record<string, SeasonLeaguePrediction>>
}

export type SeasonLeaguePredictionFixture = {
  id: string
  kickoffAt: string | null
  status: string
  home: string
  away: string
  result: { home: number; away: number } | null
}

export type SeasonLeagueMatchweekPredictions = {
  league: { id: string; name: string | null }
  matchweek: {
    id: string
    ordinal: number
    label: string
    /** The server's lock instant. Presentation only — never a reveal decision. */
    locksAt: string | null
  }
  /** The server's answer to "may these be shown". The only reveal authority. */
  revealed: boolean
  serverNow: string | null
  fixtures: readonly SeasonLeaguePredictionFixture[]
  memberCount: number
  /** How many members predicted this matchweek. Zero while hidden, by design. */
  predictedCount: number
  /**
   * CONTRACT 171. How many member rows this payload carried, and whether that
   * was all of them. The read caps at 200 rows — since contract 171 in the same
   * total order the aggregate ranks by, so the cap keeps the TOP rows rather
   * than an accident of the query plan — and `memberCount` above is the
   * league's REAL size. Without these two, 200 rows beside a count of 300 is
   * indistinguishable from a hundred members who did not predict.
   *
   * Decoded, never derived: `membersReturned < memberCount` is also the
   * ordinary shape of a hidden matchweek, which carries no rows at all.
   */
  membersReturned: number
  membersTruncated: boolean
  /** Empty while hidden. */
  members: readonly SeasonLeaguePredictionMember[]
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

function scoreOrNull(value: unknown): { home: number; away: number } | null {
  const row = objectOf(value)
  const home = integerOrNull(row.home)
  const away = integerOrNull(row.away)
  // A half-score is not a score. Guessing the missing side is not a decoder's
  // decision to take.
  return home !== null && away !== null ? { home, away } : null
}

function mapPredictions(value: unknown): Record<string, SeasonLeaguePrediction> {
  const row = objectOf(value)
  const predictions: Record<string, SeasonLeaguePrediction> = {}
  for (const [fixtureId, prediction] of Object.entries(row)) {
    const score = scoreOrNull(prediction)
    if (score) predictions[fixtureId] = score
  }
  return predictions
}

function mapMember(value: unknown): SeasonLeaguePredictionMember | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  const displayName = stringOrNull(row.display_name)
  if (!userId || !displayName) return null

  return {
    userId,
    displayName,
    isSelf: row.is_self === true,
    points: integerOrNull(row.points),
    settledAt: stringOrNull(row.settled_at),
    jokerPlayed: row.joker_played === true,
    predictions: mapPredictions(row.predictions),
  }
}

function mapFixture(value: unknown): SeasonLeaguePredictionFixture | null {
  const row = objectOf(value)
  const id = stringOrNull(row.id)
  const status = stringOrNull(row.status)
  const home = stringOrNull(row.home)
  const away = stringOrNull(row.away)
  if (!id || !status || !home || !away) return null

  return {
    id,
    kickoffAt: stringOrNull(row.kickoff_at),
    status,
    home,
    away,
    result: scoreOrNull(row.result),
  }
}

/** Pure decoder, so the reveal behaviour is testable without a client. */
export function mapSeasonLeagueMatchweekPredictions(
  value: unknown,
): SeasonLeagueMatchweekPredictions {
  const payload = objectOf(value)
  const league = objectOf(payload.league)
  const matchweek = objectOf(payload.matchweek)

  const leagueId = stringOrNull(league.id)
  const matchweekId = stringOrNull(matchweek.id)
  const ordinal = integerOrNull(matchweek.ordinal)
  const label = stringOrNull(matchweek.label)

  if (!leagueId || !matchweekId || ordinal === null || !label) {
    throw new Error('The league matchweek predictions response was not in the expected shape.')
  }

  const revealed = payload.revealed === true
  const rawFixtures = Array.isArray(payload.fixtures) ? payload.fixtures : []
  const rawMembers = Array.isArray(payload.members) ? payload.members : []

  const members = revealed
    ? rawMembers
        .map(mapMember)
        .filter((member): member is SeasonLeaguePredictionMember => member !== null)
    : []

  return {
    league: { id: leagueId, name: stringOrNull(league.name) },
    matchweek: {
      id: matchweekId,
      ordinal,
      label,
      locksAt: stringOrNull(matchweek.locks_at),
    },
    revealed,
    serverNow: stringOrNull(payload.server_now),
    fixtures: rawFixtures
      .map(mapFixture)
      .filter((fixture): fixture is SeasonLeaguePredictionFixture => fixture !== null),
    memberCount: integerOrNull(payload.member_count) ?? 0,
    predictedCount: integerOrNull(payload.predicted_count) ?? 0,
    // Contract 171.
    //
    // `membersReturned` is the rows this decoder KEPT rather than the server's
    // own `members_returned`, and deliberately: the two agree in every ordinary
    // case, and where they disagree it is because a malformed row was dropped
    // here — in which case the smaller number is the one that matches what a
    // reader can actually see. It also means a server that predates contract
    // 171 needs no fallback.
    //
    // `membersTruncated` is the server's answer and is never derived. Comparing
    // the two counts in the browser would be wrong in both directions: a hidden
    // matchweek carries no rows at all, and a list exactly at the cap may or may
    // not have lost one.
    membersReturned: members.length,
    membersTruncated: payload.members_truncated === true,
    // Belt and braces with the server: an un-revealed payload carries no
    // members, and if one ever did this would still not show them.
    members,
  }
}
