import { describe, expect, it } from 'vitest'
import { mapEntrySubmissionStatus } from '../../src/services/supabase/predictions'

describe('entry submission status parsing', () => {
  it('maps an automatic submission outcome', () => {
    expect(
      mapEntrySubmissionStatus({
        state: 'automatically_submitted',
        lockAt: '2028-06-09T19:00:00Z',
        submittedAt: '2028-06-09T19:00:12Z',
        attemptedAt: '2028-06-09T19:00:12Z',
        failureCode: null,
        failureMessage: null,
      }),
    ).toEqual({
      state: 'automatically_submitted',
      lockAt: '2028-06-09T19:00:00Z',
      submittedAt: '2028-06-09T19:00:12Z',
      attemptedAt: '2028-06-09T19:00:12Z',
      failureCode: null,
      failureMessage: null,
    })
  })

  it('maps the authoritative invalid-entry explanation', () => {
    expect(
      mapEntrySubmissionStatus({
        state: 'automatic_submission_failed',
        lockAt: '2028-06-09T19:00:00Z',
        submittedAt: null,
        attemptedAt: '2028-06-09T19:00:19Z',
        failureCode: '23514',
        failureMessage: 'Group A is unresolved: predict every match before submitting',
      }),
    ).toMatchObject({
      state: 'automatic_submission_failed',
      failureCode: '23514',
      failureMessage: 'Group A is unresolved: predict every match before submitting',
    })
  })

  it('fails closed to a pending state for malformed data', () => {
    expect(mapEntrySubmissionStatus({ state: 'invented', submittedAt: 123 })).toEqual({
      state: 'pending',
      lockAt: null,
      submittedAt: null,
      attemptedAt: null,
      failureCode: null,
      failureMessage: null,
    })
  })
})
