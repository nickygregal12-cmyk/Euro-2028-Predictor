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
