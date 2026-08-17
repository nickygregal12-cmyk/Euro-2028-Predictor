import * as z from 'zod/mini'
import { describe, expect, it } from 'vitest'
import {
  isAiLabRawSnapshot,
  parseAiLabRawSnapshot,
  type AiLabRawSnapshot,
} from '../../../src/services/supabase/aiLabBoundary'

const aiLabRawSnapshotSchema = z.custom<AiLabRawSnapshot>(isAiLabRawSnapshot)

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
    expect(aiLabRawSnapshotSchema.parse(completeSnapshot)).toEqual(completeSnapshot)
  })

  it('rejects a structurally incomplete RPC fan-out', () => {
    const { odds: _odds, ...missingOdds } = completeSnapshot
    expect(() => parseAiLabRawSnapshot(missingOdds)).toThrow(TypeError)
    expect(aiLabRawSnapshotSchema.safeParse(missingOdds).success).toBe(false)
  })

  it('rejects an accidental expansion of the browser-side RPC contract', () => {
    const expandedSnapshot = {
      ...completeSnapshot,
      internalTrainingRows: [],
    }
    expect(() => parseAiLabRawSnapshot(expandedSnapshot)).toThrow(TypeError)
    expect(aiLabRawSnapshotSchema.safeParse(expandedSnapshot).success).toBe(false)
  })
})
