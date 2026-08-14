import { db } from './client'

/**
 * Contract 179's caller-addressed private-container reads.
 *
 * Private Last Man Standing and Predictor Championship competitions are
 * `bonus_competitions`, not ordinary `leagues`. These wrappers keep that
 * distinction explicit so `/leagues` can rediscover a successful create/join
 * after a hard reload without routing the two storage models through one RPC.
 */

export type PrivateCompetitionGameKey = 'last_man_standing' | 'predictor_cup'

export type PrivateCompetitionDiscovery = {
  competitionId: string
  name: string
  gameKey: PrivateCompetitionGameKey
  gameName: string
  tournamentId: string
  seasonName: string
  seasonKey: string | null
  seasonKind: string | null
  isOwner: boolean
  membershipStatus: string | null
  lifecycleState: string | null
  members: number
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

/**
 * The caller's private LMS/Championship containers, newest first.
 *
 * The server clamps a page to 50. The global surface deliberately asks for one
 * maximum page and must state `hasMore` rather than silently pretending that a
 * truncated page is complete.
 */
export async function fetchMyPrivateCompetitions(
  limit = 50,
  offset = 0,
): Promise<PrivateCompetitionDiscoveryPage> {
  const { data, error } = await db.rpc('get_my_private_competitions', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return mapPrivateCompetitionDiscoveryPage(data)
}

/**
 * Read the Championship launch verdict from the private-container workspace.
 *
 * The browser never recomputes eligibility. Contract 179 derives this from the
 * same authorities the launch command uses and additionally removes `canLaunch`
 * from non-organisers.
 */
export async function fetchPrivateCupLaunchReadiness(
  competitionId: string,
): Promise<PrivateCupLaunchReadiness | null> {
  const { data, error } = await db.rpc('get_private_competition_workspace', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return mapPrivateCupLaunchReadiness(data)
}
