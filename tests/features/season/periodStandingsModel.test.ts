import { describe, expect, it } from 'vitest'
import { presentPeriodStandings } from '../../../src/features/season/periodStandingsModel'
import type { SeasonPeriodRow } from '../../../src/services/supabase/seasonPeriodStandings'
import { at } from '../../support/indexed'

function row(overrides: Partial<SeasonPeriodRow> = {}): SeasonPeriodRow {
  return {
    entryId: 'entry-1',
    rank: 1,
    points: 30,
    matchweeksPlayed: 3,
    displayName: null,
    ...overrides,
  }
}

describe('presentPeriodStandings', () => {
  it('falls back to "Entrant" when the server sent no name', () => {
    // Contract 122's shape, which contract 131 made optional rather than
    // removed: a row with no name is an entrant at a rank. A raw identifier is
    // not a name and must not reach the interface.
    const view = presentPeriodStandings(
      {
        period: 'form',
        window: 5,
        rows: [row({ entryId: 'mine' }), row({ entryId: 'theirs', rank: 2, points: 21 })],
      },
      'mine',
    )

    expect(view.tables[0]?.rows.map((r) => r.label)).toEqual(['You', 'Entrant'])
    // The entry id survives as the React key and in nothing else — not in the
    // label, and not in the sentence assistive technology reads out.
    const other = at(at(view.tables, 0).rows, 1)
    expect(other.key).toBe('theirs')
    expect(other.label).not.toContain('theirs')
    expect(other.accessibleSummary).not.toContain('theirs')
  })

  it('uses contract 131’s name when the server sends one', () => {
    const view = presentPeriodStandings(
      {
        period: 'form',
        window: 5,
        rows: [
          row({ entryId: 'mine', displayName: 'Sam' }),
          row({ entryId: 'theirs', rank: 2, points: 21, displayName: 'Alex' }),
        ],
      },
      'mine',
    )

    // "You" still outranks the caller's own name: a player scanning for
    // themselves scans for that word, not for their display name.
    expect(view.tables[0]?.rows.map((r) => r.label)).toEqual(['You', 'Alex'])
    expect(view.tables[0]?.rows[1]?.accessibleSummary).toContain('Alex')
  })

  it('marks nobody when the caller holds no entry', () => {
    const view = presentPeriodStandings(
      { period: 'form', window: 5, rows: [row()] },
      null,
    )

    expect(view.tables[0]?.rows[0]?.isYou).toBe(false)
    expect(view.tables[0]?.yourLine).toBeNull()
  })

  it('marks a shared rank as shared, without re-ranking', () => {
    const view = presentPeriodStandings(
      {
        period: 'form',
        window: 5,
        rows: [row({ entryId: 'a', rank: 1 }), row({ entryId: 'b', rank: 1 })],
      },
      'a',
    )

    expect(view.tables[0]?.rows.map((r) => r.rankLabel)).toEqual(['=1', '=1'])
    expect(view.tables[0]?.yourLine).toContain('joint 1')
  })

  it('shows the top of a long table and says how long it is', () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row({ entryId: `entry-${index}`, rank: index + 1, points: 100 - index }),
    )

    const view = presentPeriodStandings({ period: 'form', window: 5, rows }, null, 10)

    expect(view.tables[0]?.rows).toHaveLength(10)
    expect(view.tables[0]?.totalCount).toBe(25)
  })

  it('pins the caller beneath the table when they fall outside the rows shown', () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row({ entryId: `entry-${index}`, rank: index + 1, points: 100 - index }),
    )

    const view = presentPeriodStandings({ period: 'form', window: 5, rows }, 'entry-20', 10)

    expect(view.tables[0]?.pinnedYou?.rank).toBe(21)
    expect(view.tables[0]?.yourLine).toContain('21 of 25')
  })

  it('does not pin a row the caller can already see', () => {
    const view = presentPeriodStandings(
      { period: 'form', window: 5, rows: [row({ entryId: 'mine' })] },
      'mine',
    )

    expect(view.tables[0]?.pinnedYou).toBeNull()
    expect(view.tables[0]?.yourLine).toContain('1 of 1')
  })

  it('reads months newest first', () => {
    // The read returns them ascending because that is the natural key order; a
    // retention view is read newest-first.
    const view = presentPeriodStandings(
      {
        period: 'month',
        months: [
          { month: '2026-08', rows: [row()] },
          { month: '2026-09', rows: [row()] },
          { month: '2026-12', rows: [row()] },
        ],
      },
      null,
    )

    expect(view.tables.map((table) => table.month)).toEqual(['2026-12', '2026-09', '2026-08'])
  })

  it('reports an empty view rather than an empty table', () => {
    const view = presentPeriodStandings({ period: 'form', window: 5, rows: [] }, null)

    expect(view.empty).toBe(true)
    expect(view.tables).toEqual([])
  })

  it('always states that neither view decides the season', () => {
    // ADR 0012: the cumulative total is the only ranking that settles a league
    // season. A monthly winner beside a season table must not read as a rival
    // claim, so the sentence is unconditional rather than shown on suspicion.
    const view = presentPeriodStandings({ period: 'month', months: [] }, null)

    expect(view.derivedNote).toMatch(/decided by the overall table/)
  })

  it('carries the form window through, so the surface can say what it counted', () => {
    const view = presentPeriodStandings({ period: 'form', window: 3, rows: [row()] }, null)

    expect(view.window).toBe(3)
  })

  it('gives a month no window, because a month is not a count of matchweeks', () => {
    const view = presentPeriodStandings(
      { period: 'month', months: [{ month: '2026-08', rows: [row()] }] },
      null,
    )

    expect(view.window).toBeNull()
  })
})
