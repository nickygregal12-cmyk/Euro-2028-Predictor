import * as z from 'zod/mini'

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

function isAiLabRawSnapshot(value: unknown): value is AiLabRawSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const keys = Object.keys(value)
  if (keys.length !== AI_LAB_RAW_SNAPSHOT_KEYS.length) return false

  return AI_LAB_RAW_SNAPSHOT_KEYS.every((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  )
}

/**
 * Runtime guard for the private AI Lab RPC fan-out.
 *
 * The inner payloads intentionally remain `unknown`: aiLabModel.ts owns the
 * tolerant field-by-field normalization that keeps the admin page useful while
 * a server rollout is partially populated. Zod protects the structural seam —
 * all eight RPC responses must be present and no accidental ninth payload may
 * silently become part of the browser contract.
 *
 * This custom Zod Mini schema keeps the exact-key contract while avoiding the
 * heavier object-schema machinery in the browser bundle.
 */
export const aiLabRawSnapshotSchema = z.custom<AiLabRawSnapshot>(isAiLabRawSnapshot)

export function parseAiLabRawSnapshot(value: unknown): AiLabRawSnapshot {
  return aiLabRawSnapshotSchema.parse(value)
}
