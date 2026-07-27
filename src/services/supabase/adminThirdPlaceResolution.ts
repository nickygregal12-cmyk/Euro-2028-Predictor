import { supabase } from './client'

export type ActualThirdPlaceResolutionState =
  | 'not_ready'
  | 'clear'
  | 'requires_resolution'
  | 'resolved'

export type ActualThirdPlaceResolutionTeam = {
  teamId: string
  teamName: string
  groupLetter: string
  points: number
  goalDifference: number
  goalsFor: number
  wins: number
  currentPosition: number | null
}

export type ActualThirdPlaceResolutionStatus = {
  state: ActualThirdPlaceResolutionState
  message: string | null
  tieKey: string | null
  basisHash: string | null
  higherCount: number | null
  blockSize: number | null
  qualifyingPlaces: number | null
  teams: ActualThirdPlaceResolutionTeam[]
  orderedTeamIds: string[]
  version: number | null
  reason: string | null
  updatedAt: string | null
}

export type ActualThirdPlaceResolutionRevision = {
  revision: number
  action: 'resolve' | 'correct' | 'clear'
  previousResolution: Record<string, unknown>
  newResolution: Record<string, unknown>
  reason: string
  recordedAt: string
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function mapTeam(value: unknown): ActualThirdPlaceResolutionTeam | null {
  const row = objectOf(value)
  const teamId = stringOrNull(row.teamId)
  const teamName = stringOrNull(row.teamName)
  const groupLetter = stringOrNull(row.groupLetter)
  const points = numberOrNull(row.points)
  const goalDifference = numberOrNull(row.goalDifference)
  const goalsFor = numberOrNull(row.goalsFor)
  const wins = numberOrNull(row.wins)

  if (
    !teamId ||
    !teamName ||
    !groupLetter ||
    points === null ||
    goalDifference === null ||
    goalsFor === null ||
    wins === null
  ) {
    return null
  }

  return {
    teamId,
    teamName,
    groupLetter,
    points,
    goalDifference,
    goalsFor,
    wins,
    currentPosition: numberOrNull(row.currentPosition),
  }
}

function mapStatus(value: unknown): ActualThirdPlaceResolutionStatus {
  const row = objectOf(value)
  const rawState = stringOrNull(row.state)
  const state: ActualThirdPlaceResolutionState =
    rawState === 'not_ready' ||
    rawState === 'clear' ||
    rawState === 'requires_resolution' ||
    rawState === 'resolved'
      ? rawState
      : 'not_ready'

  return {
    state,
    message: stringOrNull(row.message),
    tieKey: stringOrNull(row.tieKey),
    basisHash: stringOrNull(row.basisHash),
    higherCount: numberOrNull(row.higherCount),
    blockSize: numberOrNull(row.blockSize),
    qualifyingPlaces: numberOrNull(row.qualifyingPlaces),
    teams: Array.isArray(row.teams)
      ? row.teams.map(mapTeam).filter((team): team is ActualThirdPlaceResolutionTeam => Boolean(team))
      : [],
    orderedTeamIds: stringArray(row.orderedTeamIds),
    version: numberOrNull(row.version),
    reason: stringOrNull(row.reason),
    updatedAt: stringOrNull(row.updatedAt),
  }
}

export async function fetchActualThirdPlaceResolutionStatus(
  tournamentId: string,
): Promise<ActualThirdPlaceResolutionStatus> {
  const { data, error } = await supabase.rpc(
    'admin_actual_third_place_tie_status',
    { p_tournament_id: tournamentId },
  )
  if (error) throw error
  return mapStatus(data)
}

export async function fetchActualThirdPlaceResolutionRevisions(
  tournamentId: string,
): Promise<ActualThirdPlaceResolutionRevision[]> {
  const { data, error } = await supabase.rpc(
    'admin_actual_third_place_tie_revisions',
    { p_tournament_id: tournamentId },
  )
  if (error) throw error

  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const revision = numberOrNull(row.revision)
    const action = stringOrNull(row.action)
    const reason = stringOrNull(row.reason)
    const recordedAt = stringOrNull(row.recorded_at)
    if (
      revision === null ||
      (action !== 'resolve' && action !== 'correct' && action !== 'clear') ||
      !reason ||
      !recordedAt
    ) {
      return []
    }

    return [
      {
        revision,
        action,
        previousResolution: objectOf(row.previous_resolution),
        newResolution: objectOf(row.new_resolution),
        reason,
        recordedAt,
      },
    ]
  })
}

export async function resolveActualThirdPlaceTie(input: {
  tournamentId: string
  orderedTeamIds: string[]
  reason: string
}): Promise<ActualThirdPlaceResolutionStatus> {
  const { data, error } = await supabase.rpc(
    'admin_resolve_actual_third_place_tie',
    {
      p_tournament_id: input.tournamentId,
      p_ordered_team_ids: input.orderedTeamIds,
      p_reason: input.reason.trim(),
    },
  )
  if (error) throw error
  return mapStatus(data)
}

export async function clearActualThirdPlaceTie(input: {
  tournamentId: string
  reason: string
}): Promise<ActualThirdPlaceResolutionStatus> {
  const { data, error } = await supabase.rpc(
    'admin_clear_actual_third_place_tie',
    {
      p_tournament_id: input.tournamentId,
      p_reason: input.reason.trim(),
    },
  )
  if (error) throw error
  return mapStatus(data)
}
