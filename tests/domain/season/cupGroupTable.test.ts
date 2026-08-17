import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCupGroupTable,
  executeCupSplit,
  type CupEntrantRecord,
  type CupTableRow,
  type CupTableTie,
} from '../../../src/domain/season/cupGroupTable'

/**
 * ADR 0014 and the pinned table rules: football logic on head-to-head
 * results, the tie-break sequence terminating at the neutral draw number,
 * and the split as a continuation with points carried through.
 */

function record(entryId: string, overrides: Partial<CupEntrantRecord> = {}): CupEntrantRecord {
  return {
    entryId,
    windowPredictionPoints: 0,
    exactScores: 0,
    correctResults: 0,
    scorelineError: 0,
    drawNumber: entryId.charCodeAt(0),
    ...overrides,
  }
}

function tie(
  homeEntryId: string,
  homePoints: number,
  awayEntryId: string,
  awayPoints: number,
): CupTableTie {
  return { homeEntryId, awayEntryId, homePoints, awayPoints }
}

describe('the table follows football logic on head-to-head results', () => {
  it('awards 3, 1 and 0 and carries the prediction points that produced them', () => {
    const result = buildCupGroupTable(
      [record('a'), record('b'), record('c')],
      [tie('a', 21, 'b', 16), tie('b', 14, 'c', 14), tie('a', 9, 'c', 18)],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const byId = new Map(result.rows.map((row) => [row.entryId, row]))

    expect(byId.get('a')).toMatchObject({
      played: 2,
      won: 1,
      drawn: 0,
      lost: 1,
      pointsFor: 30,
      pointsAgainst: 34,
      pointsDifference: -4,
      tablePoints: 3,
    })
    expect(byId.get('b')).toMatchObject({ played: 2, won: 0, drawn: 1, lost: 1, tablePoints: 1 })
    expect(byId.get('c')).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, tablePoints: 4 })
  })

  it('ranks by table points first and numbers positions from one', () => {
    const result = buildCupGroupTable(
      [record('a'), record('b'), record('c')],
      [tie('a', 21, 'b', 16), tie('b', 14, 'c', 14), tie('a', 9, 'c', 18)],
    )
    expect(result.ok && result.rows.map((row) => [row.entryId, row.position])).toEqual([
      ['c', 1],
      ['a', 2],
      ['b', 3],
    ])
  })
})

describe('the pinned tie-break sequence', () => {
  const level = [tie('a', 10, 'b', 5), tie('b', 10, 'a', 5)] // one win each

  it('breaks level table points on total window prediction points', () => {
    const result = buildCupGroupTable(
      [
        record('a', { windowPredictionPoints: 40 }),
        record('b', { windowPredictionPoints: 55 }),
      ],
      level,
    )
    expect(result.ok && result.rows[0]?.entryId).toBe('b')
  })

  it('falls to exacts, then correct results, when window points are level', () => {
    const byExacts = buildCupGroupTable(
      [
        record('a', { windowPredictionPoints: 40, exactScores: 3 }),
        record('b', { windowPredictionPoints: 40, exactScores: 5 }),
      ],
      level,
    )
    expect(byExacts.ok && byExacts.rows[0]?.entryId).toBe('b')

    const byResults = buildCupGroupTable(
      [
        record('a', { windowPredictionPoints: 40, exactScores: 3, correctResults: 9 }),
        record('b', { windowPredictionPoints: 40, exactScores: 3, correctResults: 4 }),
      ],
      level,
    )
    expect(byResults.ok && byResults.rows[0]?.entryId).toBe('a')
  })

  it('falls to lowest scoreline error before the draw number', () => {
    const result = buildCupGroupTable(
      [record('a', { scorelineError: 30 }), record('b', { scorelineError: 12 })],
      level,
    )
    expect(result.ok && result.rows[0]?.entryId).toBe('b')
  })

  it('always terminates on the neutral draw number — ranking is total', () => {
    // Identical in every respect but the draw number; lower goes first.
    const result = buildCupGroupTable(
      [record('a', { drawNumber: 77 }), record('b', { drawNumber: 12 })],
      level,
    )
    expect(result.ok && result.rows.map((row) => row.entryId)).toEqual(['b', 'a'])
    expect(result.ok && result.rows.map((row) => row.position)).toEqual([1, 2])
  })
})

describe('contradictory data refuses', () => {
  it('refuses unknown entrants, self-ties and duplicates', () => {
    expect(buildCupGroupTable([record('a')], [tie('a', 5, 'ghost', 3)])).toEqual({
      ok: false,
      reason: 'unknown_entrant',
    })
    expect(buildCupGroupTable([record('a')], [tie('a', 5, 'a', 3)])).toEqual({
      ok: false,
      reason: 'entrant_against_itself',
    })
    expect(buildCupGroupTable([record('a'), record('a')], [])).toEqual({
      ok: false,
      reason: 'duplicate_entrant',
    })
    expect(
      buildCupGroupTable([record('a', { drawNumber: 4 }), record('b', { drawNumber: 4 })], []),
    ).toEqual({ ok: false, reason: 'duplicate_draw_number' })
  })

  it('refuses malformed entrants and an empty field', () => {
    expect(buildCupGroupTable([], [])).toEqual({ ok: false, reason: 'invalid_input' })
    expect(buildCupGroupTable([record('  ')], [])).toEqual({ ok: false, reason: 'invalid_input' })
    expect(
      buildCupGroupTable([record('a', { drawNumber: 1.5 })], []),
    ).toEqual({ ok: false, reason: 'invalid_input' })
  })
})

describe('the split continues the competition', () => {
  function ranked(size: number): CupTableRow[] {
    return Array.from({ length: size }, (_, index) => ({
      entryId: `entrant-${index + 1}`,
      position: index + 1,
      played: 3,
      won: 3 - index,
      drawn: 0,
      lost: index,
      pointsFor: 100 - index,
      pointsAgainst: 50,
      pointsDifference: 50 - index,
      tablePoints: 30 - index,
    }))
  }

  it('divides an even field in half and carries every point through', () => {
    const rows = ranked(12)
    const result = executeCupSplit(rows)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [top, bottom] = result.halves

    expect(top.half).toBe('top')
    expect(top.rows.map((row) => row.entryId)).toEqual(rows.slice(0, 6).map((row) => row.entryId))
    expect(bottom.rows.map((row) => row.entryId)).toEqual(rows.slice(6).map((row) => row.entryId))
    // Points carry through — the split is not a reset.
    expect(top.rows.map((row) => row.tablePoints)).toEqual(rows.slice(0, 6).map((row) => row.tablePoints))
    expect(bottom.rows[0]?.tablePoints).toBe(rows[6]?.tablePoints)
  })

  it('eliminates nobody — every entrant lands in exactly one half', () => {
    const rows = ranked(13)
    const result = executeCupSplit(rows)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const placed = [...result.halves[0].rows, ...result.halves[1].rows].map((row) => row.entryId)
    expect(placed.sort()).toEqual(rows.map((row) => row.entryId).sort())
  })

  it('gives the larger half to the top when the field is odd — thirteen becomes seven and six', () => {
    const result = executeCupSplit(ranked(13))
    expect(result.ok && [result.halves[0].rows.length, result.halves[1].rows.length]).toEqual([7, 6])
  })

  it('refuses a field too small to split and an unranked table', () => {
    expect(executeCupSplit(ranked(3))).toEqual({ ok: false, reason: 'field_too_small' })
    const unranked = ranked(6).map((row) => ({ ...row, position: 1 }))
    expect(executeCupSplit(unranked)).toEqual({ ok: false, reason: 'invalid_input' })
  })
})

describe('authority separation', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/domain/season/cupGroupTable.ts'),
    'utf8',
  )

  it('imports nothing from the tournament implementation', () => {
    expect(source).not.toMatch(/from '.*tournament/)
  })

  it('reads no ambient clock or zone', () => {
    expect(source).not.toMatch(/Date\.now|new Date\(|Intl\./)
  })
})
