import { describe, expect, it } from 'vitest'
import type { CompetitionEntryState } from '../../src/domain/competition/context'
import { isEntryLocked } from '../../src/domain/tournament/entryLock'

function context(entryState: CompetitionEntryState) {
  return { entryState }
}

describe('isEntryLocked', () => {
  it('keeps open entry states editable', () => {
    expect(isEntryLocked(context('not_started'))).toBe(false)
    expect(isEntryLocked(context('incomplete'))).toBe(false)
    expect(isEntryLocked(context('valid_unsubmitted'))).toBe(false)
    expect(isEntryLocked(context('submitted'))).toBe(false)
    expect(isEntryLocked(context('auto_submitted'))).toBe(false)
  })

  it('reports a valid entry as locked once the engine closes its active scope', () => {
    expect(isEntryLocked(context('locked'))).toBe(true)
  })

  it('reports a missing valid post-lock entry as locked rather than editable', () => {
    expect(isEntryLocked(context('no_valid_entry'))).toBe(true)
  })
})
