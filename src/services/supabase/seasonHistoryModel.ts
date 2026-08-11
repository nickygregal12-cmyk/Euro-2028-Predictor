/**
 * Every season this player has taken part in (contract 161, `MIG-UI-17`).
 *
 * IT IS KEYED ON PARTICIPATION, NOT PUBLICATION, and that is the whole reason
 * it exists. The Profile's season history was built on the published weekly
 * catalogue, so a season that stopped being published stopped being findable —
 * a player's 2026/27 would vanish the day it was archived. This asks a
 * different question: which seasons did YOU play in, whatever the catalogue
 * currently lists.
 *
 * IT TAKES NO PLAYER ARGUMENT, so it is not a directory. It answers about the
 * caller and nobody else.
 *
 * `inPublishedCatalogue` IS CARRIED SO A SURFACE CAN BE HONEST ABOUT ROUTING. A
 * season the catalogue no longer publishes has no route to open, and saying
 * "archived" beats rendering a link that goes nowhere.
 *
 * `final` IS CONTRACT 156'S WRAPPED, NOT A SECOND SCORING AUTHORITY. It is
 * present only where a Wrapped was finalised, and it is the same stored
 * snapshot the Wrapped surface reads. Nothing here recomputes a total.
 *
 * PURE.
 */

export type SeasonHistoryGame = {
  gameKey: string | null
  gameName: string | null
  competitionId: string | null
  competitionName: string | null
  visibility: string | null
  membershipStatus: string | null
  outcome: string | null
  joinedAt: string | null
  leftAt: string | null
}

export type SeasonHistoryFinal = {
  points: number
  rank: number | null
  fieldSize: number | null
  matchweeksPlayed: number
  finalisedAt: string | null
}

export type SeasonHistoryEntry = {
  tournamentId: string
  seasonName: string
  seasonKey: string | null
  kind: string | null
  status: string | null
  displayTimeZone: string | null
  competitionId: string | null
  competitionName: string | null
  /** Null when the season is no longer routable; never derived from a name. */
  competitionSlug: string | null
  /** False for a season the weekly catalogue no longer publishes. */
  inPublishedCatalogue: boolean
  complete: boolean
  wrappedAvailable: boolean
  /** Contract 156's stored snapshot. Null until the season is finalised. */
  final: SeasonHistoryFinal | null
  games: readonly SeasonHistoryGame[]
}

export type SeasonHistoryPage = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
  seasons: readonly SeasonHistoryEntry[]
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function countOf(value: unknown): number {
  const parsed = integerOrNull(value)
  return parsed !== null && parsed >= 0 ? parsed : 0
}

function mapGame(value: unknown): SeasonHistoryGame {
  const row = objectOf(value)
  return {
    gameKey: stringOrNull(row.game_key),
    gameName: stringOrNull(row.game_name),
    competitionId: stringOrNull(row.competition_id),
    competitionName: stringOrNull(row.competition_name),
    visibility: stringOrNull(row.visibility),
    membershipStatus: stringOrNull(row.membership_status),
    outcome: stringOrNull(row.outcome),
    joinedAt: stringOrNull(row.joined_at),
    leftAt: stringOrNull(row.left_at),
  }
}

function mapEntry(value: unknown): SeasonHistoryEntry | null {
  const row = objectOf(value)
  const tournamentId = stringOrNull(row.tournament_id)
  const seasonName = stringOrNull(row.season_name)
  // A season with no id cannot be read from again and one with no name cannot
  // be listed. Dropped rather than rendered as a blank row in somebody's own
  // history, which would read as a season they cannot remember playing.
  if (!tournamentId || !seasonName) return null

  const final = row.final === null || row.final === undefined ? null : objectOf(row.final)

  return {
    tournamentId,
    seasonName,
    seasonKey: stringOrNull(row.season_key),
    kind: stringOrNull(row.kind),
    status: stringOrNull(row.status),
    displayTimeZone: stringOrNull(row.display_timezone),
    competitionId: stringOrNull(row.competition_id),
    competitionName: stringOrNull(row.competition_name),
    competitionSlug: stringOrNull(row.competition_slug),
    inPublishedCatalogue: row.in_published_catalogue === true,
    complete: row.complete === true,
    wrappedAvailable: row.wrapped_available === true,
    final: final
      ? {
          points: countOf(final.points),
          // Kept nullable: "we do not know where you finished" and "you
          // finished nowhere" are not the same sentence.
          rank: integerOrNull(final.rank),
          fieldSize: integerOrNull(final.field_size),
          matchweeksPlayed: countOf(final.matchweeks_played),
          finalisedAt: stringOrNull(final.finalised_at),
        }
      : null,
    games: arrayOf(row.games).map(mapGame),
  }
}

export function mapSeasonHistoryPage(payload: unknown): SeasonHistoryPage {
  const root = objectOf(payload)
  return {
    total: countOf(root.total),
    limit: countOf(root.limit),
    offset: countOf(root.offset),
    hasMore: root.has_more === true,
    seasons: arrayOf(root.seasons)
      .map(mapEntry)
      .filter((entry): entry is SeasonHistoryEntry => entry !== null),
  }
}
