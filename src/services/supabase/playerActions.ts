import { db } from './client'

export type PersistentPlayerAction = {
  actionKey: string
  actionType: string
  priority: number
  tournamentId: string
  competitionId: string | null
  deadlineAt: string | null
  expiresAt: string | null
  context: Record<string, unknown>
  seen: boolean
  seenAt: string | null
  dismissed: boolean
  generatedAt: string
}

export type PlayerActionsFeed = {
  unseen: number
  actions: readonly PersistentPlayerAction[]
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`The ${label} response was not in the expected shape.`)
  }
  return value as Record<string, unknown>
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`The player action response is missing ${key}.`)
  }
  return value
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new Error(`The player action response has an invalid ${key}.`)
  }
  return value
}

function mapAction(value: unknown): PersistentPlayerAction {
  const row = record(value, 'player action')
  const priority = row.priority
  if (typeof priority !== 'number' || !Number.isFinite(priority)) {
    throw new Error('The player action response has an invalid priority.')
  }

  return {
    actionKey: requiredString(row, 'action_key'),
    // Keep this open to future server values rather than silently dropping a
    // new kind the server has begun to generate. The presentation layer has a
    // safe generic label for an unfamiliar type.
    actionType: requiredString(row, 'action_type'),
    priority,
    tournamentId: requiredString(row, 'tournament_id'),
    competitionId: nullableString(row, 'competition_id'),
    deadlineAt: nullableString(row, 'deadline_at'),
    expiresAt: nullableString(row, 'expires_at'),
    context: record(row.context ?? {}, 'player action context'),
    seen: row.seen === true,
    seenAt: nullableString(row, 'seen_at'),
    dismissed: row.dismissed === true,
    generatedAt: requiredString(row, 'generated_at'),
  }
}

export function mapPlayerActionsFeed(value: unknown): PlayerActionsFeed {
  const row = record(value, 'player actions')
  if (!Array.isArray(row.actions)) {
    throw new Error('The player actions response is missing its actions list.')
  }
  const unseen = row.unseen
  if (typeof unseen !== 'number' || !Number.isInteger(unseen) || unseen < 0) {
    throw new Error('The player actions response has an invalid unseen count.')
  }
  return {
    unseen,
    actions: row.actions.map(mapAction),
  }
}

/** Read only the caller's canonical, server-derived persistent action feed. */
export async function fetchMyActions(limit = 20): Promise<PlayerActionsFeed> {
  const { data, error } = await db.rpc('get_my_actions', {
    p_limit: limit,
    p_include_dismissed: false,
  })
  if (error) throw error
  return mapPlayerActionsFeed(data)
}

/** Persist cross-device seen state. No deadline or completion is client-owned. */
export async function markMyActionsSeen(actionKeys: readonly string[]): Promise<void> {
  if (actionKeys.length === 0) return
  const { error } = await db.rpc('mark_actions_seen', {
    p_action_keys: [...actionKeys],
  })
  if (error) throw error
}

/** Dismiss one server-issued action key for the signed-in caller. */
export async function dismissMyAction(actionKey: string): Promise<void> {
  const { error } = await db.rpc('dismiss_action', {
    p_action_key: actionKey,
  })
  if (error) throw error
}
