import { db } from './client'
import {
  metadataAllowsAdminCapability,
  parseAdminAccess,
  type AdminCapability,
} from './adminCapabilities'

export type { AdminCapability } from './adminCapabilities'

export type AdminAccessSnapshot = {
  readonly userId: string
  readonly email: string | null
  readonly isSuperAdmin: boolean
  readonly capabilities: readonly AdminCapability[]
}

export function snapshotAllowsCapability(
  snapshot: AdminAccessSnapshot,
  capability: AdminCapability,
): boolean {
  return snapshot.isSuperAdmin || snapshot.capabilities.includes(capability)
}

export function snapshotHasAnyAdminAccess(snapshot: AdminAccessSnapshot): boolean {
  return snapshot.isSuperAdmin || snapshot.capabilities.length > 0
}

/**
 * Refresh the authenticated user from Supabase Auth and parse ONLY app_metadata.
 * `getUser()` is used rather than trusting cached route/local state because this
 * is discovery for a privileged surface. Server RPCs still enforce every write.
 */
export async function fetchAdminAccessSnapshot(): Promise<AdminAccessSnapshot | null> {
  const { data, error } = await db.auth.getUser()
  if (error || !data.user) return null

  const access = parseAdminAccess(data.user.app_metadata)
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    isSuperAdmin: access.isSuperAdmin,
    capabilities: access.capabilities,
  }
}

export async function hasTournamentAdminAccess(
  capability: AdminCapability = 'results',
): Promise<boolean> {
  const { data, error } = await db.auth.getUser()
  if (error || !data.user) return false

  return metadataAllowsAdminCapability(data.user.app_metadata, capability)
}
