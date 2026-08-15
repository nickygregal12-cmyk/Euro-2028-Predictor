import { z } from 'zod'

/**
 * Runtime guard for the private AI Lab RPC fan-out.
 *
 * The inner payloads intentionally remain `unknown`: aiLabModel.ts owns the
 * tolerant field-by-field normalization that keeps the admin page useful while
 * a server rollout is partially populated. Zod protects the structural seam —
 * all eight RPC responses must be present and no accidental ninth payload may
 * silently become part of the browser contract.
 */
export const aiLabRawSnapshotSchema = z
  .object({
    dashboard: z.unknown(),
    upcoming: z.unknown(),
    recent: z.unknown(),
    breakdown: z.unknown(),
    betting: z.unknown(),
    bettingGate: z.unknown(),
    markets: z.unknown(),
    odds: z.unknown(),
  })
  .strict()

export type AiLabRawSnapshot = z.infer<typeof aiLabRawSnapshotSchema>

export function parseAiLabRawSnapshot(value: unknown): AiLabRawSnapshot {
  return aiLabRawSnapshotSchema.parse(value)
}
