/**
 * Contract 177's batch reconciliation response, decoded. Pure: no Supabase
 * import, no network, no clock — the configured wrapper is
 * `seasonPredictionBatch.ts`.
 *
 * THE OUTCOMES ARE THE VOCABULARY AND THEY ARE NOT INTERCHANGEABLE. `accepted`
 * is written. `locked` is not retryable and the draft is the player's to
 * discard. `conflict` carries BOTH scorelines — the stored one and the drafted
 * one — because that is precisely the choice a reconciliation surface has to
 * put in front of somebody. `invalid` and `refused` are the two ways the server
 * said no for a reason that is not either of the first two. Collapsing any of
 * them into "failed" would hide the one fact the player needs to act.
 *
 * AN UNRECOGNISED OUTCOME IS `refused`, NOT `accepted`. If contract 177 grew a
 * sixth token, a decoder that defaulted the unknown one to success would mark a
 * draft as saved that was not. The safe default is the one that keeps the
 * player's work and says the server did not take it.
 *
 * A RESULT WITH NO FIXTURE ID IS DROPPED. It cannot be matched to a draft, so
 * it can neither clear one nor be shown against one.
 */

export type PredictionBatchOutcome =
  | 'accepted'
  | 'locked'
  | 'conflict'
  | 'invalid'
  | 'refused'

export type PredictionBatchScore = { home: number | null; away: number | null; version: number | null }

export type PredictionBatchResultRow = {
  fixtureId: string
  outcome: PredictionBatchOutcome
  /** The server's own sentence. Never replaced with a generic one. */
  reason: string | null
  /** Present on `accepted`: the new stored version, to keep drafting from. */
  version: number | null
  /** Present on `accepted`: the draft cleared the prediction rather than set it. */
  cleared: boolean
  /** Present on `conflict`: what the server holds now. */
  stored: PredictionBatchScore | null
  /** Present on `conflict`: what this device was trying to submit. */
  draft: PredictionBatchScore | null
  /** Present on `refused`: the SQLSTATE, for an honest message rather than a guess. */
  sqlstate: string | null
}

export type PredictionBatchResult = {
  serverNow: string | null
  submitted: number
  accepted: number
  rejected: number
  results: readonly PredictionBatchResultRow[]
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

const OUTCOMES: readonly PredictionBatchOutcome[] = [
  'accepted',
  'locked',
  'conflict',
  'invalid',
  'refused',
]

function outcomeOf(value: unknown): PredictionBatchOutcome {
  return OUTCOMES.includes(value as PredictionBatchOutcome)
    ? (value as PredictionBatchOutcome)
    : 'refused'
}

function scoreOrNull(value: unknown): PredictionBatchScore | null {
  if (value === null || value === undefined) return null
  const row = objectOf(value)
  return {
    home: integerOr(row.home, null),
    away: integerOr(row.away, null),
    version: integerOr(row.version, null),
  }
}

function mapRow(value: unknown): PredictionBatchResultRow | null {
  const row = objectOf(value)
  const fixtureId = stringOrNull(row.fixture_id)
  if (fixtureId === null) return null
  const outcome = outcomeOf(row.outcome)
  return {
    fixtureId,
    outcome,
    reason: stringOrNull(row.reason),
    version: integerOr(row.version, null),
    cleared: row.cleared === true,
    stored: outcome === 'conflict' ? scoreOrNull(row.stored) : null,
    draft: outcome === 'conflict' ? scoreOrNull(row.draft) : null,
    sqlstate: stringOrNull(row.sqlstate),
  }
}

export function mapPredictionBatchResult(value: unknown): PredictionBatchResult {
  const payload = objectOf(value)
  const submitted = integerOr(payload.submitted, null)
  const accepted = integerOr(payload.accepted, null)
  const rejected = integerOr(payload.rejected, null)

  if (submitted === null || accepted === null || rejected === null) {
    throw new Error('The prediction batch response was not in the expected shape.')
  }

  const raw = Array.isArray(payload.results) ? payload.results : []

  return {
    serverNow: stringOrNull(payload.server_now),
    submitted,
    accepted,
    rejected,
    results: raw.map(mapRow).filter((row): row is PredictionBatchResultRow => row !== null),
  }
}
