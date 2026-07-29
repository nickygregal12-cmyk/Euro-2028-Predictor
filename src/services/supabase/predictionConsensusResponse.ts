import {
  mapPredictionConsensus,
  type PredictionConsensus,
} from './predictionConsensusModel'

export type SuppressedPredictionConsensus = {
  suppressed: true
  reason: 'not_enough_entries'
  minimumEntries: number
  submittedEntries: number
  serverNow: string
  lockedAt: string
}

export type AvailablePredictionConsensus = PredictionConsensus & {
  suppressed: false
  minimumEntries: number
}

export type PredictionConsensusResponse =
  | SuppressedPredictionConsensus
  | AvailablePredictionConsensus

type RecordValue = Record<string, unknown>

function recordOf(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Prediction consensus was malformed.')
  }
  return value as RecordValue
}

function integerOf(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} was malformed.`)
  }
  return value
}

function timestampOf(value: unknown, label: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} was malformed.`)
  }
  return value
}

export function mapPredictionConsensusResponse(
  value: unknown,
): PredictionConsensusResponse {
  const payload = recordOf(value)
  const minimumEntries = integerOf(
    payload.minimum_entries,
    'Consensus minimum entry count',
    1,
  )
  const submittedEntries = integerOf(
    payload.submitted_entries,
    'Submitted entry count',
  )
  const serverNow = timestampOf(payload.server_now, 'Consensus server time')
  const lockedAt = timestampOf(payload.locked_at, 'Consensus lock time')

  if (payload.suppressed === true) {
    if (payload.reason !== 'not_enough_entries') {
      throw new Error('Consensus suppression reason was malformed.')
    }
    if (submittedEntries >= minimumEntries) {
      throw new Error('Consensus suppression threshold was malformed.')
    }
    return {
      suppressed: true,
      reason: 'not_enough_entries',
      minimumEntries,
      submittedEntries,
      serverNow,
      lockedAt,
    }
  }

  if (payload.suppressed !== false) {
    throw new Error('Consensus suppression state was malformed.')
  }
  if (submittedEntries < minimumEntries) {
    throw new Error('Consensus availability threshold was malformed.')
  }

  return {
    ...mapPredictionConsensus(value),
    suppressed: false,
    minimumEntries,
  }
}
