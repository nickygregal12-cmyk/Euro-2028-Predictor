import { supabase } from './client'
import {
  metadataAllowsAdminCapability,
  type AdminCapability,
} from './adminCapabilities'

export type { AdminCapability } from './adminCapabilities'

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
