/**
 * Contract 175's What-If projection, decoded. Pure: no Supabase import, no
 * network, no clock — the configured wrapper is `seasonMatchweekProjection.ts`.
 *
 * WHY A DECODER AND NOT A DERIVATION. `INNOV-001` shipped on 11 August 2026 as
 * browser arithmetic over the provisional score, because contract 175 was not
 * hosted and the surface would otherwise have had nothing to show. It is hosted
 * now, so the projection has a server authority and this module's whole job is
 * to read what that authority said. Nothing here computes a point value: the
 * numbers come from `predictor_internal.season_fixture_points`, the same
 * function settlement banks from, and a browser that recomputed them would be a
 * second scoring engine with a different answer.
 *
 * THE BASIS IS THE SERVER'S WORD AND IS NEVER INFERRED. Each fixture states
 * whether its score is `official` (contract 125's protected writer), a
 * `provisional` provider opinion (contract 135) or `none` at all. A surface must
 * not decide that for itself — "there is a number, so it must be a result" is
 * exactly how a provider opinion becomes a settled point on screen.
 *
 * A FIXTURE WITH AN UNKNOWN BASIS IS DROPPED, not defaulted. Defaulting to
 * `none` would report a fixture as unscored when the server may have called it
 * official; defaulting to `official` would do the opposite and worse. A payload
 * this decoder does not understand is a payload it does not render.
 *
 * BRANCHES ARE THE SERVER'S TOO. A branch exists only where contract 175 built
 * one — a fixture actually in play — and its `matchweekPoints` is the WHOLE
 * matchweek under that hypothetical, post-Joker, exactly as
 * `season_matchweek_points` reports a banked total. It is not this fixture's
 * points and must never be printed as though it were.
 *
 * THE LEAGUE HALF IS "AS IT STANDS" AND SAYS SO. Contract 175 projects each
 * member's matchweek on the basis every fixture actually has; it does not
 * project a league under a branch, and this decoder does not invent one.
 * Before the matchweek's own lock the server hides the block completely — no
 * member rows, not even redacted ones — and `revealed: false` is that state
 * rather than an error.
 */

export type ProjectionScore = { home: number; away: number }

/** The server's own vocabulary. An unrecognised token drops the fixture. */
export type ProjectionBasis = 'official' | 'provisional' | 'none'

export type ProjectionProvisional = ProjectionScore & {
  providerStatus: string | null
  kind: string | null
  observedAt: string | null
}

export type ProjectionBranch = {
  /** The hypothetical scoreline this branch is asking about. */
  score: ProjectionScore
  /** The player's whole matchweek under it, post-Joker. Never one fixture. */
  matchweekPoints: number
}

export type ProjectionFixture = {
  fixtureId: string
  homeTeamId: string | null
  awayTeamId: string | null
  kickoffAt: string | null
  status: string | null
  basis: ProjectionBasis
  /** Present only when `basis` is `official`. */
  official: ProjectionScore | null
  /** Present only when `basis` is `provisional`. */
  provisional: ProjectionProvisional | null
  prediction: ProjectionScore | null
  /** This fixture alone, undoubled. The Joker doubles a matchweek, not a row. */
  points: number
  /** Null unless the fixture is in play. Both branches, or neither. */
  branches: { homeScores: ProjectionBranch; awayScores: ProjectionBranch } | null
}

export type ProjectionLeagueRow = {
  userId: string
  displayName: string
  isSelf: boolean
  /** A member of the league who holds no entry in the season. */
  entered: boolean
  bankedPoints: number
  /** Null for a member with no entry — there is no matchweek to project. */
  projectedMatchweekPoints: number | null
  projectedPoints: number
  currentRank: number
  projectedRank: number
}

export type ProjectionLeague =
  | {
      leagueId: string
      name: string
      revealed: false
      /** The server's reason token, e.g. `matchweek_not_locked`. */
      reason: string | null
      locksAt: string | null
    }
  | {
      leagueId: string
      name: string
      revealed: true
      locksAt: string | null
      /** The league's REAL size. May exceed `rows.length`. */
      membersTotal: number | null
      membersReturned: number
      membersTruncated: boolean
      rows: readonly ProjectionLeagueRow[]
    }

export type SeasonMatchweekProjection = {
  serverNow: string | null
  tournamentId: string
  matchweek: { id: string; ordinal: number; label: string | null }
  locksAt: string | null
  locked: boolean
  jokerPlayed: boolean
  /** The whole matchweek as it stands, post-Joker. */
  projectedPoints: number
  /** True once the matchweek's points are banked. A projection is then history. */
  settled: boolean
  fixtures: readonly ProjectionFixture[]
  league: ProjectionLeague | null
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function scoreOrNull(value: unknown): ProjectionScore | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const home = integerOr(row.home, null)
  const away = integerOr(row.away, null)
  if (home === null || away === null) return null
  return { home, away }
}

function basisOf(value: unknown): ProjectionBasis | null {
  return value === 'official' || value === 'provisional' || value === 'none' ? value : null
}

function branchOrNull(value: unknown): ProjectionBranch | null {
  const row = objectOf(value)
  const score = scoreOrNull(row)
  const points = integerOr(row.matchweek_points, null)
  if (score === null || points === null) return null
  return { score, matchweekPoints: points }
}

function mapFixture(value: unknown): ProjectionFixture | null {
  const row = objectOf(value)
  const fixtureId = stringOrNull(row.fixture_id)
  const basis = basisOf(row.basis)
  const points = integerOr(row.points, null)
  // A fixture with no id cannot be matched to the match being read, an unknown
  // basis cannot be labelled, and a missing point value cannot be shown. All
  // three are "this row is not renderable", which is a drop rather than a guess.
  if (fixtureId === null || basis === null || points === null) return null

  const provisionalRow = objectOf(row.provisional)
  const provisionalScore = scoreOrNull(row.provisional)

  const branches = objectOf(row.branches)
  const homeScores = branchOrNull(branches.home_scores)
  const awayScores = branchOrNull(branches.away_scores)

  return {
    fixtureId,
    homeTeamId: stringOrNull(row.home_team_id),
    awayTeamId: stringOrNull(row.away_team_id),
    kickoffAt: stringOrNull(row.kickoff_at),
    status: stringOrNull(row.status),
    basis,
    official: basis === 'official' ? scoreOrNull(row.official) : null,
    provisional:
      basis === 'provisional' && provisionalScore
        ? {
            ...provisionalScore,
            providerStatus: stringOrNull(provisionalRow.provider_status),
            kind: stringOrNull(provisionalRow.kind),
            observedAt: stringOrNull(provisionalRow.observed_at),
          }
        : null,
    prediction: scoreOrNull(row.prediction),
    points,
    // Both branches or neither: one alone would offer the player a next goal
    // for one side and silently none for the other.
    branches: homeScores && awayScores ? { homeScores, awayScores } : null,
  }
}

function mapLeagueRow(value: unknown): ProjectionLeagueRow | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  const bankedPoints = integerOr(row.banked_points, null)
  const projectedPoints = integerOr(row.projected_points, null)
  const currentRank = integerOr(row.current_rank, null)
  const projectedRank = integerOr(row.projected_rank, null)
  if (
    userId === null ||
    bankedPoints === null ||
    projectedPoints === null ||
    currentRank === null ||
    projectedRank === null
  ) {
    return null
  }
  return {
    userId,
    displayName: stringOrNull(row.display_name) ?? 'Player',
    isSelf: row.is_self === true,
    entered: row.entered === true,
    bankedPoints,
    projectedMatchweekPoints: integerOr(row.projected_matchweek_points, null),
    projectedPoints,
    currentRank,
    projectedRank,
  }
}

function mapLeague(value: unknown): ProjectionLeague | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const leagueId = stringOrNull(row.league_id)
  if (leagueId === null) return null
  const name = stringOrNull(row.name) ?? 'Your league'
  const locksAt = stringOrNull(row.locks_at)

  if (row.revealed !== true) {
    return { leagueId, name, revealed: false, reason: stringOrNull(row.reason), locksAt }
  }

  const raw = Array.isArray(row.table) ? row.table : []
  const rows = raw.map(mapLeagueRow).filter((entry): entry is ProjectionLeagueRow => entry !== null)

  return {
    leagueId,
    name,
    revealed: true,
    locksAt,
    membersTotal: integerOr(row.members_total, null),
    // What this decoder actually carries, not what the server counted. The two
    // agree unless a row was dropped as unreadable, and "showing 12 of 40"
    // beside eleven visible rows is its own small lie.
    membersReturned: rows.length,
    membersTruncated: row.members_truncated === true || rows.length < raw.length,
    rows,
  }
}

export function mapSeasonMatchweekProjection(value: unknown): SeasonMatchweekProjection {
  const payload = objectOf(value)
  const tournamentId = stringOrNull(payload.tournament_id)
  const matchweek = objectOf(payload.matchweek)
  const matchweekId = stringOrNull(matchweek.matchweek_id)
  const ordinal = integerOr(matchweek.ordinal, null)
  const projectedPoints = integerOr(payload.projected_points, null)

  if (tournamentId === null || matchweekId === null || ordinal === null || projectedPoints === null) {
    throw new Error('The matchweek projection response was not in the expected shape.')
  }

  const fixtures = Array.isArray(payload.fixtures) ? payload.fixtures : []

  return {
    serverNow: stringOrNull(payload.server_now),
    tournamentId,
    matchweek: { id: matchweekId, ordinal, label: stringOrNull(matchweek.label) },
    locksAt: stringOrNull(payload.locks_at),
    locked: payload.locked === true,
    jokerPlayed: payload.joker_played === true,
    projectedPoints,
    settled: payload.settled === true,
    fixtures: fixtures
      .map(mapFixture)
      .filter((fixture): fixture is ProjectionFixture => fixture !== null),
    league: mapLeague(payload.league),
  }
}
