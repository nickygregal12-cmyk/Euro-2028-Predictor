import { describe, expect, it } from 'vitest'
import {
  formatDeadline,
  formatKickoffLong,
  formatKickoffTime,
  formatKickoffWithDay,
  formatMatchDay,
  formatMonth,
  matchDayKey,
  viewerTimeZone,
} from '../../src/shared/time/kickoff'

/**
 * The one kickoff/date presentation authority (owner UI direction, 10 August
 * 2026). The zone parameter every function takes is a deterministic override
 * for tests and harnesses; production omits it and gets the viewer's device
 * zone, which is the rule these tests exist to hold.
 */

// 16:45 UTC on a Saturday in August — the direction's own worked example.
const KICKOFF = '2026-08-22T16:45:00+00:00'

describe('the viewer zone is the presentation authority', () => {
  it("renders the direction's worked example as 17:45 for a UK viewer", () => {
    expect(formatKickoffTime(KICKOFF, 'Europe/London')).toBe('17:45')
  })

  it('renders the same instant as the equivalent local time elsewhere', () => {
    // Not the competition's zone. A viewer in Auckland is told when the match
    // starts FOR THEM, and the day heading moves with it rather than leaving a
    // Sunday morning kickoff filed under Saturday.
    expect(formatKickoffTime(KICKOFF, 'Pacific/Auckland')).toBe('04:45')
    expect(matchDayKey(KICKOFF, 'Pacific/Auckland')).toBe('2026-08-23')
    // The day WORDING follows the viewer's locale, so the assertion is on the
    // facts it must carry rather than on one locale's word order.
    const day = formatMatchDay(KICKOFF, 'Pacific/Auckland') ?? ''
    expect(day).toContain('Sunday')
    expect(day).toContain('23')
    expect(day).toContain('August')
  })

  it('groups and prints in the same zone, always', () => {
    // The day key a list groups by and the heading it prints must not be
    // resolved in different zones: "Saturday 22 August" with 04:45 under it is
    // neither true.
    expect(matchDayKey(KICKOFF, 'Europe/London')).toBe('2026-08-22')
    const day = formatMatchDay(KICKOFF, 'Europe/London') ?? ''
    expect(day).toContain('Saturday')
    expect(day).toContain('22')
  })

  it('resolves a real zone when no override is supplied', () => {
    expect(viewerTimeZone()).toBeTruthy()
    expect(formatKickoffTime(KICKOFF)).toBeTruthy()
  })
})

describe('the forms a surface may use', () => {
  it('prints the time alone where a day heading already carries the date', () => {
    expect(formatKickoffTime(KICKOFF, 'Europe/London')).toBe('17:45')
  })

  it('prints a short day with the time where nothing above it carries the date', () => {
    const shown = formatKickoffWithDay(KICKOFF, 'Europe/London') ?? ''
    expect(shown).toMatch(/^Sat\b/)
    expect(shown).toContain('22')
    expect(shown.endsWith(' · 17:45')).toBe(true)
  })

  it('prints the long form for a standalone match surface', () => {
    const shown = formatKickoffLong(KICKOFF, 'Europe/London') ?? ''
    expect(shown).toMatch(/^Saturday\b/)
    expect(shown.endsWith(' · 17:45')).toBe(true)
  })

  it('gives a deadline the same shape as a kickoff', () => {
    // A player reading "Locks Sat 22 Aug · 14:30" above "17:45" is comparing two
    // times. Two formats would break that comparison.
    const deadline = formatDeadline('2026-08-22T13:30:00Z', 'Europe/London') ?? ''
    expect(deadline).toBe(formatKickoffWithDay('2026-08-22T13:30:00Z', 'Europe/London'))
    expect(deadline.endsWith(' · 14:30')).toBe(true)
  })
})

describe('no raw or broken timestamp reaches a player', () => {
  it('returns null rather than a placeholder for an absent or unparseable instant', () => {
    for (const format of [
      formatKickoffTime,
      formatMatchDay,
      formatKickoffWithDay,
      formatKickoffLong,
      matchDayKey,
      formatDeadline,
    ]) {
      expect(format(null)).toBeNull()
      expect(format(undefined)).toBeNull()
      expect(format('')).toBeNull()
      expect(format('not a date')).toBeNull()
      // The one thing that must never happen: the ISO string itself, or
      // "Invalid Date", rendered into a sentence a player reads.
      expect(format('2026-08-22T16:45:00+00:00')).not.toContain('T16:45')
    }
  })
})

describe('formatMonth', () => {
  it('names a month the way a player reads one', () => {
    expect(formatMonth('2027-01')).toBe('January 2027')
    expect(formatMonth('2026-12')).toBe('December 2026')
  })

  it('does not shift a month across the year boundary in a negative-offset locale', () => {
    // Contract 122 resolves which month a ROUND belongs to in the competition's
    // own timezone — a different question from what time a fixture kicks off
    // for the reader, and untouched by the viewer-zone rule. Parsing `2027-01`
    // as an instant would make it midnight UTC, which is December the previous
    // evening anywhere west of Greenwich.
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
