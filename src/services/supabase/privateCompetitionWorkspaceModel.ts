/**
 * Pure decoder for contract 179's caller-addressed private competition workspace.
 *
 * The workspace is deliberately narrower than the public LMS read: it proves
 * membership/ownership, lifecycle and the current private window, but it does
 * not disclose another player's club before reveal. This decoder preserves
 * those nulls instead of inventing a public-game answer for a private instance.
 */

// Not exported: reaches callers inside `PrivateCompetitionWorkspace`.
type PrivateCompetitionWorkspaceMember = {
  userId: string
  displayName: string
  isMe: boolean
  isOwner: boolean
  outcome: string | null
  membershipStatus: string | null
  hasPickedCurrentRound: boolean | null
}

type PrivateCompetitionWorkspaceRound = {
  windowId: string
  sequence: number | null
  label: string | null
  opensAt: string | null
  locksAt: string | null
  locked: boolean
}

export type PrivateCompetitionWorkspace = {
  competition: {
    id: string
    name: string
    gameKey: 'last_man_standing' | 'predictor_cup'
    gameName: string
    tournamentId: string
    seasonName: string
    seasonKey: string | null
    lifecycleState: string | null
  }
  caller: {
    isOwner: boolean
    membershipStatus: string | null
    inviteCode: string | null
    inviteAvailable: boolean
  }
  currentRound: PrivateCompetitionWorkspaceRound | null
  members: readonly PrivateCompetitionWorkspaceMember[]
  memberCount: number
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

function countOf(value: unknown): number {
  const parsed = integerOrNull(value)
  return parsed !== null && parsed >= 0 ? parsed : 0
}

function gameKeyOf(value: unknown): 'last_man_standing' | 'predictor_cup' | null {
  return value === 'last_man_standing' || value === 'predictor_cup' ? value : null
}

function memberOf(value: unknown): PrivateCompetitionWorkspaceMember | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  if (!userId) return null
  return {
    userId,
    displayName: stringOrNull(row.display_name) ?? 'Player',
    isMe: row.is_me === true,
    isOwner: row.is_owner === true,
    outcome: stringOrNull(row.outcome),
    membershipStatus: stringOrNull(row.membership_status),
    hasPickedCurrentRound:
      typeof row.has_picked_current_round === 'boolean' ? row.has_picked_current_round : null,
  }
}

function roundOf(value: unknown): PrivateCompetitionWorkspaceRound | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  const windowId = stringOrNull(row.window_id)
  if (!windowId) return null
  return {
    windowId,
    sequence: integerOrNull(row.sequence),
    label: stringOrNull(row.label),
    opensAt: stringOrNull(row.opens_at),
    locksAt: stringOrNull(row.locks_at),
    locked: row.locked === true,
  }
}

export function mapPrivateCompetitionWorkspace(payload: unknown): PrivateCompetitionWorkspace {
  const root = objectOf(payload)
  const competition = objectOf(root.competition)
  const caller = objectOf(root.caller)

  const id = stringOrNull(competition.id)
  const name = stringOrNull(competition.name)
  const gameKey = gameKeyOf(competition.game_key)
  const tournamentId = stringOrNull(competition.tournament_id)
  if (!id || !name || !gameKey || !tournamentId) {
    throw new Error('The private competition workspace response was not in the expected shape.')
  }

  const members = (Array.isArray(root.members) ? root.members : [])
    .map(memberOf)
    .filter((member): member is PrivateCompetitionWorkspaceMember => member !== null)

  return {
    competition: {
      id,
      name,
      gameKey,
      gameName:
        stringOrNull(competition.game_name) ??
        (gameKey === 'last_man_standing' ? 'Last Man Standing' : 'Predictor Championship'),
      tournamentId,
      seasonName: stringOrNull(competition.season_name) ?? 'Competition',
      seasonKey: stringOrNull(competition.season_key),
      lifecycleState: stringOrNull(competition.lifecycle_state),
    },
    caller: {
      isOwner: caller.is_owner === true,
      membershipStatus: stringOrNull(caller.membership_status),
      inviteCode: stringOrNull(caller.invite_code),
      inviteAvailable: caller.invite_available === true,
    },
    currentRound: roundOf(root.current_round),
    members,
    memberCount: countOf(root.member_count),
  }
}
