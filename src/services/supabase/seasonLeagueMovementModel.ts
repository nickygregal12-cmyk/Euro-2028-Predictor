/**
 * How a private league's table moved over one settled matchweek (contract 150,
 * `MIG-UI-03`).
 *
 * WHY IT IS A READ AND NOT ARITHMETIC IN THE BROWSER. The gap to a rival is
 * already derivable on screen because both players are on it; movement is not,
 * because "5th to 3rd" needs the table as it stood BEFORE the matchweek and
 * history is not on screen. The server derives it from
 * `season_matchweek_scores` — nothing is stored, so nothing can disagree with
 * the totals the season and the leagues already use.
 *
 * ONLY A SETTLED MATCHWEEK MOVES ANYTHING. An unsettled one comes back
 * `settled: false` with no rows, which is an answer and not a failure: a
 * matchweek still being scored is one whose totals are still changing, and
 * reporting a climb from it would show a player a position they never held. No
 * surface below may render movement while `settled` is false.
 *
 * ORDERING IS BY ROUND ORDINAL, in the server, so a postponed matchweek that
 * settles late does not appear to come after matchweeks played after it.
 *
 * `movement` IS SIGNED, POSITIVE MEANS CLIMBED. The server states a number
 * rather than a direction word so the caller decides how to say it.
 */

export type SeasonLeagueMovementRow = {
  userId: string
  displayName: string
  isSelf: boolean
  pointsBefore: number
  pointsAfter: number
  /** Null for a member who banked nothing in this matchweek. */
  pointsThisMatchweek: number | null
  rankBefore: number
  rankAfter: number
  /** Positive is a climb. `rankBefore - rankAfter`. */
  movement: number
  gapToLeaderBefore: number
  gapToLeaderAfter: number
}

export type SeasonLeagueMovement = {
  leagueId: string
  /** Null when the season has settled nothing at all. */
  matchweek: { id: string; ordinal: number; label: string } | null
  settled: boolean
  serverNow: string | null
  /** Empty unless `settled`. */
  members: readonly SeasonLeagueMovementRow[]
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

function mapRow(value: unknown): SeasonLeagueMovementRow | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  const displayName = stringOrNull(row.display_name)
  const pointsBefore = integerOrNull(row.points_before)
  const pointsAfter = integerOrNull(row.points_after)
  const rankBefore = integerOrNull(row.rank_before)
  const rankAfter = integerOrNull(row.rank_after)
  const movement = integerOrNull(row.movement)

  // A row missing a rank cannot describe a movement, and half of one is worse
  // than none: it would print an arrow with nothing behind it.
  if (
    !userId ||
    !displayName ||
    pointsBefore === null ||
    pointsAfter === null ||
    rankBefore === null ||
    rankAfter === null ||
    movement === null
  ) {
    return null
  }

  return {
    userId,
    displayName,
    isSelf: row.is_self === true,
    pointsBefore,
    pointsAfter,
    pointsThisMatchweek: integerOrNull(row.points_this_matchweek),
    rankBefore,
    rankAfter,
    movement,
    gapToLeaderBefore: integerOrNull(row.gap_to_leader_before) ?? 0,
    gapToLeaderAfter: integerOrNull(row.gap_to_leader_after) ?? 0,
  }
}

/** Pure decoder. The settled gate is re-stated here rather than assumed. */
export function mapSeasonLeagueMovement(value: unknown): SeasonLeagueMovement {
  const payload = objectOf(value)
  const league = objectOf(payload.league)
  const leagueId = stringOrNull(league.id)
  if (!leagueId) {
    throw new Error('The league movement response was not in the expected shape.')
  }

  const matchweek = objectOf(payload.matchweek)
  const matchweekId = stringOrNull(matchweek.id)
  const ordinal = integerOrNull(matchweek.ordinal)
  const label = stringOrNull(matchweek.label)

  const settled = payload.settled === true
  const rawMembers = Array.isArray(payload.members) ? payload.members : []

  return {
    leagueId,
    matchweek:
      matchweekId && ordinal !== null && label
        ? { id: matchweekId, ordinal, label }
        : null,
    settled,
    serverNow: stringOrNull(payload.server_now),
    members: settled
      ? rawMembers
          .map(mapRow)
          .filter((row): row is SeasonLeagueMovementRow => row !== null)
      : [],
  }
}
