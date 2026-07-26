import { supabase } from './client'

export type AdminCapability = 'results' | 'users' | 'leagues' | 'tournament'

type AdminMetadata = {
  admin_role?: unknown
  admin_capabilities?: unknown
}

export function metadataAllowsAdminCapability(
  metadata: AdminMetadata | null | undefined,
  capability: AdminCapability,
): boolean {
  if (!metadata) return false
  if (metadata.admin_role === 'super_admin') return true
  if (!Array.isArray(metadata.admin_capabilities)) return false
  return metadata.admin_capabilities.some((value) => value === capability)
}

export async function hasTournamentAdminAccess(
  capability: AdminCapability = 'results',
): Promise<boolean> {
  // getUser validates the access token with Supabase Auth instead of trusting a
  // locally decoded session. app_metadata is server-controlled; user_metadata
  // must never be used for authorisation.
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return false
  return metadataAllowsAdminCapability(data.user.app_metadata, capability)
}
