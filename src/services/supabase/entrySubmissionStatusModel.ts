export type EntrySubmissionState =
  | 'pending'
  | 'automatic_submission_pending'
  | 'manually_submitted'
  | 'automatically_submitted'
  | 'automatic_submission_failed'

export type EntrySubmissionStatus = {
  state: EntrySubmissionState
  lockAt: string | null
  submittedAt: string | null
  attemptedAt: string | null
  failureCode: string | null
  failureMessage: string | null
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function mapEntrySubmissionStatus(value: unknown): EntrySubmissionStatus {
  const row = objectOf(value)
  const rawState = stringOrNull(row.state)
  const state: EntrySubmissionState =
    rawState === 'pending' ||
    rawState === 'automatic_submission_pending' ||
    rawState === 'manually_submitted' ||
    rawState === 'automatically_submitted' ||
    rawState === 'automatic_submission_failed'
      ? rawState
      : 'pending'

  return {
    state,
    lockAt: stringOrNull(row.lockAt),
    submittedAt: stringOrNull(row.submittedAt),
    attemptedAt: stringOrNull(row.attemptedAt),
    failureCode: stringOrNull(row.failureCode),
    failureMessage: stringOrNull(row.failureMessage),
  }
}
