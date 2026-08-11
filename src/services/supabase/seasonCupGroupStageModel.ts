/**
 * The Predictor Championship's group stage (contract 167).
 *
 * IT IS THE READER FOR CONTRACT 166'S DRAW, AND IT SHIPPED WITH IT. A draw
 * nothing can read is the defect behind seven earlier contracts in this
 * repository — an authority written, granted and never called — and 166 and 167
 * landed together specifically so that could not happen an eighth time.
 *
 * IT RECOMPUTES NOTHING. Group rank, table points, points for and against and
 * the tie-break inputs are all the standings authority's. This orders nothing
 * and totals nothing; `rank` is printed as sent.
 *
 * ENTRANCY IS THE GATE, AND `entered: false` IS A REAL ANSWER. A player who is
 * not in the competition is told so rather than shown an empty bracket, and the
 * competition is still named — which is what makes "you are not in this one"
 * actionable instead of confusing.
 *
 * MULTI-GROUP IS THE POINT. `groups` may hold one or many, `myGroupOrdinal`
 * says which is the caller's, and a surface navigates between them rather than
 * assuming the first is theirs.
 *
 * PURE.
 */

export type CupGroupRow = {
  rank: number
  userId: string
  displayName: string
  isMe: boolean
  drawNumber: number | null
  tablePoints: number
  pointsFor: number
  pointsAgainst: number
  windowPoints: number
  exacts: number
  corrects: number
  scorelineError: number | null
}

export type CupGroup = {
  groupId: string
  ordinal: number
  size: number
  isMyGroup: boolean
  rows: readonly CupGroupRow[]
}

export type CupGroupStageCompetition = {
  id: string
  name: string
  seasonName: string | null
  seasonKey: string | null
  visibility: string | null
  completedAt: string | null
}

export type SeasonCupGroupStage =
  | { available: false }
  | {
      available: true
      entered: false
      competition: { id: string; name: string; seasonName: string | null }
    }
  | {
      available: true
      entered: true
      competition: CupGroupStageCompetition
      groupCount: number
      /** Null when the caller holds no group — which is not the same as no groups. */
      myGroupOrdinal: number | null
      matchdays: number | null
      groups: readonly CupGroup[]
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

function mapRow(value: unknown): CupGroupRow | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  const rank = integerOrNull(row.rank)
  // A row with no rank cannot sit in a table, and putting it wherever the array
  // happened to place it is the browser-side ordering this read exists to avoid.
  if (!userId || rank === null) return null
  return {
    rank,
    userId,
    displayName: stringOrNull(row.display_name) ?? 'Player',
    isMe: row.is_me === true,
    drawNumber: integerOrNull(row.draw_number),
    tablePoints: countOf(row.table_points),
    pointsFor: countOf(row.points_for),
    pointsAgainst: countOf(row.points_against),
    windowPoints: countOf(row.window_points),
    exacts: countOf(row.exacts),
    corrects: countOf(row.corrects),
    scorelineError: integerOrNull(row.scoreline_error),
  }
}

function mapGroup(value: unknown): CupGroup | null {
  const row = objectOf(value)
  const groupId = stringOrNull(row.group_id)
  const ordinal = integerOrNull(row.ordinal)
  if (!groupId || ordinal === null) return null
  return {
    groupId,
    ordinal,
    size: countOf(row.size),
    isMyGroup: row.is_my_group === true,
    rows: arrayOf(row.rows)
      .map(mapRow)
      .filter((entry): entry is CupGroupRow => entry !== null),
  }
}

export function mapSeasonCupGroupStage(payload: unknown): SeasonCupGroupStage {
  const root = objectOf(payload)
  if (root.available !== true) return { available: false }

  const competition = objectOf(root.competition)
  const id = stringOrNull(competition.id) ?? ''
  const name = stringOrNull(competition.name) ?? ''

  if (root.entered !== true) {
    return {
      available: true,
      entered: false,
      competition: { id, name, seasonName: stringOrNull(competition.season_name) },
    }
  }

  return {
    available: true,
    entered: true,
    competition: {
      id,
      name,
      seasonName: stringOrNull(competition.season_name),
      seasonKey: stringOrNull(competition.season_key),
      visibility: stringOrNull(competition.visibility),
      completedAt: stringOrNull(competition.completed_at),
    },
    groupCount: countOf(root.group_count),
    myGroupOrdinal: integerOrNull(root.my_group_ordinal),
    matchdays: integerOrNull(root.matchdays),
    groups: arrayOf(root.groups)
      .map(mapGroup)
      .filter((group): group is CupGroup => group !== null),
  }
}

/** The caller's own group, when they hold one. */
export function myGroup(stage: SeasonCupGroupStage): CupGroup | null {
  if (!stage.available || !stage.entered) return null
  return stage.groups.find((group) => group.isMyGroup) ?? null
}
