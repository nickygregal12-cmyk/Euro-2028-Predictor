const AI_LAB_RAW_SNAPSHOT_KEYS = [
  'dashboard',
  'upcoming',
  'recent',
  'breakdown',
  'betting',
  'bettingGate',
  'markets',
  'odds',
] as const

export type AiLabRawSnapshot = Record<(typeof AI_LAB_RAW_SNAPSHOT_KEYS)[number], unknown>

/**
 * Exact structural guard for the private AI Lab RPC fan-out.
 *
 * The inner payloads intentionally remain `unknown`: aiLabModel.ts owns the
 * tolerant field-by-field normalization that keeps the admin page useful while
 * a server rollout is partially populated. This seam only guarantees that all
 * eight private RPC responses are present and that an accidental ninth payload
 * cannot silently become part of the browser contract.
 *
 * The matching Zod Mini schema lives in the boundary contract tests so Zod
 * remains part of the executable development contract without adding runtime
 * weight to the already budget-tight administrator-only route.
 */
export function isAiLabRawSnapshot(value: unknown): value is AiLabRawSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const keys = Object.keys(value)
  if (keys.length !== AI_LAB_RAW_SNAPSHOT_KEYS.length) return false

  return AI_LAB_RAW_SNAPSHOT_KEYS.every((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  )
}

export function parseAiLabRawSnapshot(value: unknown): AiLabRawSnapshot {
  if (!isAiLabRawSnapshot(value)) {
    throw new TypeError('Invalid AI Lab RPC snapshot')
  }
  return value
}
