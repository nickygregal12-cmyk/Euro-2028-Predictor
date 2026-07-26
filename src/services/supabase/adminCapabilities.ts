export type AdminCapability = 'results' | 'users' | 'leagues' | 'tournament'

export function metadataAllowsAdminCapability(
  metadata: unknown,
  capability: AdminCapability,
): boolean {
  if (!metadata || typeof metadata !== 'object') return false

  const record = metadata as Record<string, unknown>
  if (record.admin_role === 'super_admin') return true
  if (!Array.isArray(record.admin_capabilities)) return false

  return record.admin_capabilities.some((value) => value === capability)
}
