import { describe, it, expect } from 'vitest'
import { isEntryLocked } from '../../src/domain/tournament/entryLock'

const LOCK = '2028-06-09T19:00:00Z'

describe('isEntryLocked', () => {
  it('allows writes before the lock (not locked)', () => {
    expect(isEntryLocked(LOCK, new Date('2028-06-09T18:59:59Z'))).toBe(false)
  })

  it('is locked exactly at the lock instant (inclusive, matches now() >= lock)', () => {
    expect(isEntryLocked(LOCK, new Date('2028-06-09T19:00:00Z'))).toBe(true)
  })

  it('is locked after the lock', () => {
    expect(isEntryLocked(LOCK, new Date('2028-06-09T19:00:01Z'))).toBe(true)
  })

  it('is never locked when no lock time is set', () => {
    expect(isEntryLocked(null, new Date('2030-01-01T00:00:00Z'))).toBe(false)
  })
})
