import { describe, expect, it } from 'vitest'
import { mapSeasonPeriodStandings } from '../../src/services/supabase/seasonPeriodStandingsModel'

function row(overrides: Record<string, unknown> = {}) {
  return { entry_id: 'entry-1', rank: 1, points: 30, matchweeks_played: 3, ...overrides }
}

describe('mapSeasonPeriodStandings', () => {
  it('reads a form table with its window', () => {
    const parsed = mapSeasonPeriodStandings({
      period: 'form',
      window: 5,
      months: null,
      rows: [row(), row({ entry_id: 'entry-2', rank: 2, points: 21 })],
    })

    expect(parsed).toEqual({
      period: 'form',
      window: 5,
      rows: [
        { entryId: 'entry-1', rank: 1, points: 30, matchweeksPlayed: 3, displayName: null },
        { entryId: 'entry-2', rank: 2, points: 21, matchweeksPlayed: 3, displayName: null },
      ],
    })
  })

  it('carries contract 131’s name, and treats a blank one as no name', () => {
    const parsed = mapSeasonPeriodStandings({
      period: 'form',
      window: 5,
      months: null,
      rows: [
        row({ display_name: 'Sam' }),
        row({ entry_id: 'entry-2', rank: 2, display_name: '   ' }),
        row({ entry_id: 'entry-3', rank: 3, display_name: null }),
      ],
    })

    // A blank name is no name. Contract 131 sends null rather than a
    // placeholder precisely so a surface can tell the two apart, and a run of
    // whitespace would defeat that.
    expect(parsed.period === 'form' && parsed.rows.map((r) => r.displayName)).toEqual([
      'Sam',
      null,
      null,
    ])
  })

  it('reads a month table per calendar month', () => {
    const parsed = mapSeasonPeriodStandings({
      period: 'month',
      window: null,
      rows: null,
      months: [
        { month: '2026-08', rows: [row()] },
        { month: '2026-09', rows: [row({ entry_id: 'entry-2' })] },
      ],
    })

    expect(parsed.period).toBe('month')
    expect(parsed.period === 'month' && parsed.months.map((m) => m.month)).toEqual([
      '2026-08',
      '2026-09',
    ])
  })

  it('takes the shape from `period`, never from which key is populated', () => {
    // A season with nothing settled returns an empty array on either side, so
    // sniffing the populated key would read an empty month as an empty form
    // table and hand the surface the wrong heading and the wrong window.
    const parsed = mapSeasonPeriodStandings({
      period: 'month',
      window: null,
      rows: null,
      months: [],
    })

    expect(parsed.period).toBe('month')
  })

  it('treats a null row array as an empty table, not as a malformed one', () => {
    // The SQL coalesces to `[]`, but a jsonb null is the same claim: nothing
    // has settled. That is an ordinary season, not a broken payload.
    const parsed = mapSeasonPeriodStandings({ period: 'form', window: 5, rows: null })

    expect(parsed.period === 'form' && parsed.rows).toEqual([])
  })

  it('refuses a row with no matchweeks played', () => {
    // ADR 0012 pairs points with matchweeks played. Defaulting the count to
    // zero would render a plausible table in which nobody had played anything.
    expect(() =>
      mapSeasonPeriodStandings({
        period: 'form',
        window: 5,
        rows: [{ entry_id: 'entry-1', rank: 1, points: 30 }],
      }),
    ).toThrow(/malformed row/)
  })

  it('refuses a row with no entry id', () => {
    // Without it the caller's own row cannot be found, and every row would be
    // presented as somebody else's.
    expect(() =>
      mapSeasonPeriodStandings({ period: 'form', window: 5, rows: [row({ entry_id: null })] }),
    ).toThrow(/malformed row/)
  })

  it('refuses a month that is not the calendar the contract derived', () => {
    // Contract 122 formats `YYYY-MM` in the competition's own timezone.
    // Anything else means the grouping is not the one that was derived.
    expect(() =>
      mapSeasonPeriodStandings({
        period: 'month',
        months: [{ month: 'August 2026', rows: [row()] }],
      }),
    ).toThrow(/malformed month/)
  })

  it('refuses a form reply with no window', () => {
    expect(() => mapSeasonPeriodStandings({ period: 'form', rows: [] })).toThrow(/malformed/)
  })

  it('refuses a period it does not recognise', () => {
    expect(() => mapSeasonPeriodStandings({ period: 'quarter', rows: [] })).toThrow(/malformed/)
  })
})
