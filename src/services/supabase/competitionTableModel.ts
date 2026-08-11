/**
 * A competition season's own league table (contract 160, `MIG-UI-13`).
 *
 * IT IS THE SERVER'S TABLE AND NOTHING HERE RECOMPUTES IT. Points, the order,
 * the tie-breaks, any deduction and the promotion/relegation boundaries are all
 * applied server-side under the competition's own stored rules. The register
 * row said this in advance and was right: a table carries rules that belong to
 * the COMPETITION rather than to a derivation, so a browser that sorted these
 * rows itself would be publishing a second, quieter table.
 *
 * `position` IS AUTHORITATIVE AND IS NOT THE ARRAY INDEX. Renumbering from the
 * array would look identical today and disagree silently the first time the
 * server's ordering changes — which is exactly what a stored tie-break order
 * exists to allow.
 *
 * A BOUNDARY IS RENDERED ONLY WHEN THE SERVER SUPPLIES ONE. `boundary` is null
 * unless the competition PUBLISHES that boundary, which is different from not
 * knowing: contract 160 stores zero places for a competition with no promotion,
 * and zero places produce no boundary rather than an unknown one. Nothing here
 * may infer relegation from a club being bottom.
 *
 * AN ADJUSTMENT IS A DEDUCTION OR AN AWARD, NEVER ZERO. The server forbids
 * zero, because a zero-point adjustment is a record with no effect and would be
 * indistinguishable from a mistake. It is already IN `points`; it is carried
 * separately so a surface can show why a club sits where it does.
 *
 * PROVENANCE IS PART OF THE TABLE, NOT DECORATION. A table of a season with
 * matches outstanding is a real table of an incomplete season, and saying how
 * many results it counted — and how many are still to come — is what stops a
 * mid-season table reading as a final one.
 *
 * PURE. Server JSON in, presentation model out.
 */

export type CompetitionTableSeason = {
  id: string
  name: string
  seasonKey: string | null
  status: string | null
  /** The competition's own timezone. Never the viewer's. */
  displayTimeZone: string | null
}

export type CompetitionTableBoundary = 'promotion' | 'playoff' | 'relegation'

export type CompetitionTableRow = {
  /** The server's position. Never the array index. */
  position: number
  teamId: string
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  /** Already includes `adjustment`. */
  points: number
  /** Negative deducts, positive awards. Null when there is none. */
  adjustment: number | null
  /** Null unless the competition publishes that boundary. */
  boundary: CompetitionTableBoundary | null
}

export type CompetitionTableRules = {
  /**
   * False when the competition has never had its rules set and the server is
   * using its documented defaults. A surface may say so; it may not substitute
   * rules of its own.
   */
  configured: boolean
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  /** The competition's stated order, applied server-side. Display only here. */
  tieBreakers: readonly string[]
  promotionPlaces: number
  playoffPlaces: number
  relegationPlaces: number
}

export type CompetitionTableProvenance = {
  fixturesCounted: number
  fixturesOutstanding: number
  /** Abandoned or void — counted by neither side. */
  fixturesExcluded: number
  fixturesAwarded: number
  lastResultAt: string | null
  providerConfirmed: number
  administratorConfirmed: number
  providers: readonly string[]
}

export type CompetitionTable = {
  season: CompetitionTableSeason
  rules: CompetitionTableRules
  rows: readonly CompetitionTableRow[]
  provenance: CompetitionTableProvenance
}

const BOUNDARIES: readonly string[] = ['promotion', 'playoff', 'relegation']

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

function mapRow(value: unknown): CompetitionTableRow | null {
  const row = objectOf(value)
  const position = integerOrNull(row.position)
  const teamId = stringOrNull(row.team_id)
  const teamName = stringOrNull(row.team_name)
  const points = integerOrNull(row.points)

  // A row without a position, an identity or a points total cannot appear in a
  // table. Dropped rather than half-drawn: a club with a blank position would
  // sit wherever the array happened to put it, which is precisely the
  // browser-side ordering this read exists to prevent.
  if (position === null || !teamId || !teamName || points === null) return null

  const boundary =
    typeof row.boundary === 'string' && BOUNDARIES.includes(row.boundary)
      ? (row.boundary as CompetitionTableBoundary)
      : null

  return {
    position,
    teamId,
    teamName,
    played: countOf(row.played),
    won: countOf(row.won),
    drawn: countOf(row.drawn),
    lost: countOf(row.lost),
    goalsFor: countOf(row.goals_for),
    goalsAgainst: countOf(row.goals_against),
    // Signed: a negative goal difference is ordinary and `countOf` would floor
    // it at zero, which would silently show a struggling club as level.
    goalDifference: integerOrNull(row.goal_difference) ?? 0,
    points,
    adjustment: integerOrNull(row.adjustment),
    boundary,
  }
}

export function mapCompetitionTable(payload: unknown): CompetitionTable {
  const root = objectOf(payload)
  const season = objectOf(root.season)
  const rules = objectOf(root.rules)
  const provenance = objectOf(root.provenance)

  return {
    season: {
      id: stringOrNull(season.id) ?? '',
      name: stringOrNull(season.name) ?? '',
      seasonKey: stringOrNull(season.season_key),
      status: stringOrNull(season.status),
      displayTimeZone: stringOrNull(season.display_timezone),
    },
    rules: {
      configured: rules.configured === true,
      pointsWin: integerOrNull(rules.points_win) ?? 3,
      pointsDraw: integerOrNull(rules.points_draw) ?? 1,
      pointsLoss: integerOrNull(rules.points_loss) ?? 0,
      tieBreakers: arrayOf(rules.tie_breakers).filter(
        (entry): entry is string => typeof entry === 'string',
      ),
      promotionPlaces: countOf(rules.promotion_places),
      playoffPlaces: countOf(rules.playoff_places),
      relegationPlaces: countOf(rules.relegation_places),
    },
    rows: arrayOf(root.rows)
      .map(mapRow)
      .filter((row): row is CompetitionTableRow => row !== null),
    provenance: {
      fixturesCounted: countOf(provenance.fixtures_counted),
      fixturesOutstanding: countOf(provenance.fixtures_outstanding),
      fixturesExcluded: countOf(provenance.fixtures_excluded),
      fixturesAwarded: countOf(provenance.fixtures_awarded),
      lastResultAt: stringOrNull(provenance.last_result_at),
      providerConfirmed: countOf(provenance.provider_confirmed),
      administratorConfirmed: countOf(provenance.administrator_confirmed),
      providers: arrayOf(provenance.providers).filter(
        (entry): entry is string => typeof entry === 'string',
      ),
    },
  }
}

/**
 * Whether this table describes a season that is still being played.
 *
 * IT IS A FACT ABOUT FIXTURES, NOT A CLOCK COMPARISON. A season with fixtures
 * outstanding is incomplete however late in the year it is, and one with none
 * is complete however early. No device time is consulted.
 */
export function isProvisional(table: CompetitionTable): boolean {
  return table.provenance.fixturesOutstanding > 0
}

/** The competition's stated tie-break order, in words a reader recognises. */
export function tieBreakerLabel(key: string): string {
  switch (key) {
    case 'goal_difference':
      return 'Goal difference'
    case 'goals_for':
      return 'Goals scored'
    case 'goals_against':
      return 'Goals conceded'
    case 'head_to_head_points':
      return 'Head-to-head points'
    case 'wins':
      return 'Wins'
    default:
      // An order this build has no phrase for prints the server's own key
      // rather than being dropped: a missing tie-break would make the published
      // order look shorter than it is.
      return key
  }
}
