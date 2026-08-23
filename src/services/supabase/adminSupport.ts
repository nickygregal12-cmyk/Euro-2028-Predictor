import { db } from './client'

export type AdminSupportUser = {
  supportRef: string
  displayName: string
  email: string | null
  accountStatus: 'active' | 'banned' | 'deleted' | 'unknown'
  createdAt: string | null
  emailConfirmedAt: string | null
  lastSignInAt: string | null
  lastSeenAt: string | null
  welcomedAt: string | null
  onboardingStep: string | null
  onboardingCompletedAt: string | null
  reminderEmails: boolean | null
  followedCompetitions: number
  gameMemberships: number
  leagueMemberships: number
}

export type AdminContainerSummary = {
  kind: 'league' | 'private-game'
  id: string
  name: string
  seasonName: string | null
  gameType: string | null
  ownerName: string
  memberCount: number
  lifecycle: string | null
  createdAt: string | null
}

class AdminSupportNotConfiguredError extends Error {
  constructor() {
    super('The read-only admin support boundary is not deployed in this environment.')
    this.name = 'AdminSupportNotConfiguredError'
  }
}

export function isAdminSupportNotConfigured(error: unknown): boolean {
  return error instanceof AdminSupportNotConfiguredError
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

export function decodeAdminSupportUsers(value: unknown): AdminSupportUser[] {
  const root = record(value)
  const rows = root && Array.isArray(root.users) ? root.users : []
  return rows.flatMap((item) => {
    const row = record(item)
    const supportRef = row ? stringOrNull(row.supportRef) : null
    if (!row || !supportRef) return []
    const status = stringOrNull(row.accountStatus)
    return [{
      supportRef,
      displayName: stringOrNull(row.displayName) ?? 'Player',
      email: stringOrNull(row.email),
      accountStatus: status === 'active' || status === 'banned' || status === 'deleted' ? status : 'unknown',
      createdAt: stringOrNull(row.createdAt),
      emailConfirmedAt: stringOrNull(row.emailConfirmedAt),
      lastSignInAt: stringOrNull(row.lastSignInAt),
      lastSeenAt: stringOrNull(row.lastSeenAt),
      welcomedAt: stringOrNull(row.welcomedAt),
      onboardingStep: stringOrNull(row.onboardingStep),
      onboardingCompletedAt: stringOrNull(row.onboardingCompletedAt),
      reminderEmails: typeof row.reminderEmails === 'boolean' ? row.reminderEmails : null,
      followedCompetitions: count(row.followedCompetitions),
      gameMemberships: count(row.gameMemberships),
      leagueMemberships: count(row.leagueMemberships),
    }]
  })
}

export function decodeAdminContainers(value: unknown): AdminContainerSummary[] {
  const root = record(value)
  const rows = root && Array.isArray(root.containers) ? root.containers : []
  return rows.flatMap((item) => {
    const row = record(item)
    const id = row ? stringOrNull(row.id) : null
    const kind = row ? stringOrNull(row.kind) : null
    if (!row || !id || (kind !== 'league' && kind !== 'private-game')) return []
    return [{
      kind,
      id,
      name: stringOrNull(row.name) ?? 'Untitled',
      seasonName: stringOrNull(row.seasonName),
      gameType: stringOrNull(row.gameType),
      ownerName: stringOrNull(row.ownerName) ?? 'Unknown owner',
      memberCount: count(row.memberCount),
      lifecycle: stringOrNull(row.lifecycle),
      createdAt: stringOrNull(row.createdAt),
    }]
  })
}

function invocationStatus(error: unknown): number | null {
  const candidate = error as { context?: unknown } | null
  const context = candidate?.context
  return typeof Response !== 'undefined' && context instanceof Response ? context.status : null
}

async function invoke(action: 'search-users' | 'search-leagues', query: string): Promise<unknown> {
  const { data, error } = await db.functions.invoke('admin-control-room', {
    body: { action, query },
  })
  if (error) {
    if (invocationStatus(error) === 404) throw new AdminSupportNotConfiguredError()
    throw new Error(error.message || 'The admin support request failed.')
  }
  return data
}

export async function searchAdminUsers(query: string): Promise<AdminSupportUser[]> {
  return decodeAdminSupportUsers(await invoke('search-users', query))
}

export async function searchAdminContainers(query: string): Promise<AdminContainerSummary[]> {
  return decodeAdminContainers(await invoke('search-leagues', query))
}
