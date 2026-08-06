import { describe, expect, it } from 'vitest'
import { formatInstant, formatMonth } from '../../../src/features/season/formatInstant'

describe('formatInstant', () => {
  it('drops the line rather than printing a placeholder for an absent instant', () => {
    // A deadline is a promise about when something stops being possible, and
    // "Invalid Date" in that sentence is worse than the sentence not appearing.
    expect(formatInstant(null)).toBeNull()
    expect(formatInstant('')).toBeNull()
    expect(formatInstant('not a date')).toBeNull()
  })

  it('formats a real instant', () => {
    expect(formatInstant('2026-08-15T14:00:00Z')).toBeTruthy()
  })
})

describe('formatMonth', () => {
  it('names a month the way a player reads one', () => {
    expect(formatMonth('2027-01')).toBe('January 2027')
    expect(formatMonth('2026-12')).toBe('December 2026')
  })

  it('does not shift a month across the year boundary in a negative-offset locale', () => {
    // Contract 122 already resolved the month in the competition's own
    // timezone. Parsing `2027-01` as an instant would make it midnight UTC,
    // which is December the previous evening anywhere west of Greenwich —
    // undoing the one decision the contract made.
    const process = globalThis.process as { env: Record<string, string | undefined> }
    const original = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      // Guard the guard: if the zone change is not actually in effect, this
      // test would pass without exercising anything.
      expect(
        new Date('2027-01').toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      ).toBe('December 2026')
      expect(formatMonth('2027-01')).toBe('January 2027')
    } finally {
      process.env.TZ = original
    }
  })

  it('returns null for anything that is not the calendar the contract derived', () => {
    expect(formatMonth(null)).toBeNull()
    expect(formatMonth('2027-13')).toBeNull()
    expect(formatMonth('January 2027')).toBeNull()
    expect(formatMonth('2027-1')).toBeNull()
  })
})
