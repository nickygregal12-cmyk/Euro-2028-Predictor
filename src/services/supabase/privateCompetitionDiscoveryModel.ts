/**
 * Pure decoders for Contract 179's private-container discovery and workspace
 * launch-readiness responses.
 *
 * The network wrapper lives beside this file. Keeping the decoder client-free
 * lets tests prove privacy and fail-closed mapping without requiring Supabase
 * configuration merely to import the module.
 */

export type PrivateCompetitionGameKey = 'last_man_standing' | 'predictor_cup'

export type PrivateCompetitionDiscovery = {
  competitionId: string
  name: string
  gameKey: PrivateCompetitionGameKey
  gameName: string
  tournamentId: string
  /** Stored season row name, e.g. "Premier League 2026/27". */
  seasonName: string
  seasonKey: string | null
  seasonKind: string | null
  isOwner: boolean
  membershipStatus: string | null
  lifecycleState: string | null
  members: number
  /** Server returns this only to the organiser. */
  inviteCode: string | null
  inviteAvailable: boolean
  workspaceAvailable: boolean
}

export type PrivateCompetitionDiscoveryPage = {
  total: number
  returned: number
  hasMore: boolean
  competitions: readonly PrivateCompetitionDiscovery[]
}

export type PrivateCupLaunchReadiness = {
  launched: boolean
  entrants: number
  remainingRounds: number
  formatKind: string | null
  canLaunch: boolean
  blockedReason: string | null
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

function countOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0
}

function gameKeyOf(value: unknown): PrivateCompetitionGameKey | null {
  return value === 'last_man_standing' || value === 'predictor_cup' ? value : null
}

function mapCompetition(value: unknown): PrivateCompetitionDiscovery | null {
  const row = objectOf(value)
  const competitionId = stringOrNull(row.competition_id)
  const name = stringOrNull(row.name)
  const gameKey = gameKeyOf(row.game_key)
  const tournamentId = stringOrNull(row.tournament_id)
  if (!competitionId || !name || !gameKey || !tournamentId) return null

  return {
    competitionId,
    name,
    gameKey,
    gameName:
      stringOrNull(row.game_name) ??
      (gameKey === 'last_man_standing' ? 'Last Man Standing' : 'Predictor Championship'),
    tournamentId,
    seasonName: stringOrNull(row.season_name) ?? 'Competition',
    seasonKey: stringOrNull(row.season_key),
    seasonKind: stringOrNull(row.season_kind),
    isOwner: row.is_owner === true,
    membershipStatus: stringOrNull(row.membership_status),
    lifecycleState: stringOrNull(row.lifecycle_state),
    members: countOf(row.members),
    inviteCode: stringOrNull(row.invite_code),
    inviteAvailable: row.invite_available === true,
    workspaceAvailable: row.workspace_available === true,
  }
}

export function mapPrivateCompetitionDiscoveryPage(payload: unknown): PrivateCompetitionDiscoveryPage {
  const root = objectOf(payload)
  const competitions = arrayOf(root.competitions)
    .map(mapCompetition)
    .filter((entry): entry is PrivateCompetitionDiscovery => entry !== null)

  return {
    total: countOf(root.total),
    returned: countOf(root.returned),
    hasMore: root.has_more === true,
    competitions,
  }
}

export function mapPrivateCupLaunchReadiness(payload: unknown): PrivateCupLaunchReadiness | null {
  const root = objectOf(payload)
  const launch = objectOf(root.launch)
  if (Object.keys(launch).length === 0) return null

  return {
    launched: launch.launched === true,
    entrants: countOf(launch.entrants),
    remainingRounds: countOf(launch.remaining_rounds),
    formatKind: stringOrNull(launch.format_kind),
    canLaunch: launch.can_launch === true,
    blockedReason: stringOrNull(launch.blocked_reason),
  }
}
