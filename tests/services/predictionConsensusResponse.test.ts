import { describe, expect, it } from 'vitest'
import { mapPredictionConsensusResponse } from '../../src/services/supabase/predictionConsensusResponse'

const timestamps = {
  server_now: '2028-06-09T12:00:00.000Z',
  locked_at: '2028-06-09T10:00:00.000Z',
}

const availablePayload = {
  ...timestamps,
  suppressed: false,
  minimum_entries: 10,
  submitted_entries: 10,
  champion_race: [],
  peoples_final: [],
  golden_boot: [],
  most_agreed_match: null,
  most_divided_match: null,
  most_trusted_team: null,
  goals_spread: {
    minimum: null,
    median: null,
    maximum: null,
    average: null,
    distinct_totals: 0,
    distribution: [],
  },
  only_you: [],
}

describe('prediction consensus response', () => {
  it('maps an explicit successful suppression state', () => {
    expect(mapPredictionConsensusResponse({
      ...timestamps,
      suppressed: true,
      reason: 'not_enough_entries',
      minimum_entries: 10,
      submitted_entries: 9,
    })).toEqual({
      suppressed: true,
      reason: 'not_enough_entries',
      minimumEntries: 10,
      submittedEntries: 9,
      serverNow: timestamps.server_now,
      lockedAt: timestamps.locked_at,
    })
  })

  it('maps an available response at the threshold', () => {
    const result = mapPredictionConsensusResponse(availablePayload)

    expect(result.suppressed).toBe(false)
    expect(result.minimumEntries).toBe(10)
    expect(result.submittedEntries).toBe(10)
  })

  it('rejects suppression at or above the threshold', () => {
    expect(() => mapPredictionConsensusResponse({
      ...timestamps,
      suppressed: true,
      reason: 'not_enough_entries',
      minimum_entries: 10,
      submitted_entries: 10,
    })).toThrow(/threshold/i)
  })

  it('rejects availability below the threshold', () => {
    expect(() => mapPredictionConsensusResponse({
      ...availablePayload,
      submitted_entries: 9,
    })).toThrow(/availability threshold/i)
  })

  it('rejects unknown suppression reasons and missing states', () => {
    expect(() => mapPredictionConsensusResponse({
      ...timestamps,
      suppressed: true,
      reason: 'other',
      minimum_entries: 10,
      submitted_entries: 2,
    })).toThrow(/reason/i)

    const { suppressed: _suppressed, ...missingState } = availablePayload
    expect(() => mapPredictionConsensusResponse(missingState)).toThrow(/suppression state/i)
  })
})
