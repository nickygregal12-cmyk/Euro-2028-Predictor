import { describe, expect, it } from 'vitest'
import {
  aiLabRawSnapshotSchema,
  parseAiLabRawSnapshot,
} from '../../../src/services/supabase/aiLabBoundary'

const completeSnapshot = {
  dashboard: {},
  upcoming: [],
  recent: [],
  breakdown: {},
  betting: {},
  bettingGate: {},
  markets: {},
  odds: {},
}

describe('AI Lab RPC boundary', () => {
  it('accepts all eight private RPC payloads while leaving their internals unknown', () => {
    expect(parseAiLabRawSnapshot(completeSnapshot)).toEqual(completeSnapshot)
  })

  it('rejects a structurally incomplete RPC fan-out', () => {
    const { odds: _odds, ...missingOdds } = completeSnapshot
    expect(aiLabRawSnapshotSchema.safeParse(missingOdds).success).toBe(false)
  })

  it('rejects an accidental expansion of the browser-side RPC contract', () => {
    expect(
      aiLabRawSnapshotSchema.safeParse({
        ...completeSnapshot,
        internalTrainingRows: [],
      }).success,
    ).toBe(false)
  })
})
