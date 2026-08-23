const ADMIN_CAPABILITIES = [
  'results',
  'users',
  'leagues',
  'tournament',
  'competitions',
] as const

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number]

type ParsedAdminAccess = {
  readonly isSuperAdmin: boolean
  readonly capabilities: readonly AdminCapability[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAdminCapability(value: unknown): value is AdminCapability {
  return typeof value === 'string' && ADMIN_CAPABILITIES.includes(value as AdminCapability)
}

/**
 * Parse ONLY the server-owned Auth app-metadata vocabulary.
 *
 * This function accepts an unknown value because Supabase metadata is external
 * input. It deliberately ignores user metadata/profile fields and drops unknown
 * capability strings rather than widening the client's permission vocabulary.
 */
export function parseAdminAccess(metadata: unknown): ParsedAdminAccess {
  if (!isRecord(metadata)) return { isSuperAdmin: false, capabilities: [] }

  const isSuperAdmin = metadata.admin_role === 'super_admin'
  const raw = metadata.admin_capabilities
  const capabilities = Array.isArray(raw)
    ? [...new Set(raw.filter(isAdminCapability))]
    : []

  return { isSuperAdmin, capabilities }
}

export function metadataAllowsAdminCapability(
  metadata: unknown,
  capability: AdminCapability,
): boolean {
  const access = parseAdminAccess(metadata)
  return access.isSuperAdmin || access.capabilities.includes(capability)
}
