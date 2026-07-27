import { supabase } from './client'
import {
  metadataAllowsAdminCapability,
  type AdminCapability,
} from './adminCapabilities'

export type { AdminCapability } from './adminCapabilities'

export async function hasTournamentAdminAccess(
  capability: AdminCapability = 'results',
): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return false

  return metadataAllowsAdminCapability(data.user.app_metadata, capability)
}
