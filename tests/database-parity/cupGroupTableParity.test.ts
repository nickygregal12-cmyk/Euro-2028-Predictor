import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * The Cup group table's ranking, in both languages — and a correction.
 *
 * WHAT I GOT WRONG. Contract 74's migration comment, and this suite's sibling
 * `seasonCupParity.test.ts`, said the season Championship "ranks by an
 * eight-step tie-break" and that the tournament and season were "two rule sets
 * for two competitions, not two implementations of one". Comparing the actual
 * comparator in `src/domain/season/cupGroupTable.ts` against the actual
 * `order by` in `predictor_internal.cup_final_group_tables` shows they are
 * IDENTICAL — same nine keys, same sequence, same directions. The "eight-step
 * tie-break" is table points plus eight tie-breaks, which is the tournament's
 * nine keys. Contract 74 is applied to development and migrations are
 * append-only after hosted application, so the correction lives here.
 *
 * WHAT REMAINS GENUINELY TOURNAMENT-SPECIFIC is the §6.3 wildcard
 * normalisation, `table_points / (group_size - 1)`, which compares third-placed
 * sides across differently sized groups in the qualification path. That is not
 * part of the group-table ordering, and the season never uses it — the guard in
 * `seasonCupParity.test.ts` still correctly excludes it.
 *
 * THE CONSEQUENCE IS GOOD. Contract 75's split cascaded, leaving
 * `cup_final_group_tables` free of tournament relations, so it can serve the
 * season directly. This suite therefore asserts parity against that EXISTING
 * function rather than requiring a season-specific one — genuinely one
 * implementation serving both competitions, which is what ADR 0022 asked for.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

function lastBody(name: string): string {
  const pattern = new RegExp(
    `create or replace function predictor_internal\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
    'g',
  )
  return [...allSql.matchAll(pattern)].map((match) => at(match, 1)).at(-1) ?? ''
}

const groupTables = lastBody('cup_final_group_tables')
const seasonSource = readFileSync(
  resolve(process.cwd(), 'src/domain/season/cupGroupTable.ts'),
  'utf8',
)

/**
 * Only the comparator. Searching the whole file finds `drawNumber` in the
 * docblock and the type definitions long before the sort, which made the
 * ordering assertion pass on prose rather than on code — the first draft of
 * this file did exactly that and reported the keys out of sequence.
 */
const comparator = seasonSource.slice(seasonSource.indexOf('const ranked ='))

/**
 * The ranking, in order. Each entry is the SQL key and the TypeScript
 * comparator that must sit at the same position.
 *
 * Order is the whole rule. Every one of these decides real qualification, and a
 * swapped pair changes who goes through without changing any total on screen —
 * which is exactly the kind of defect no fixture-based test notices.
 */
const RANKING = [
  { sql: 'wm.table_points desc', ts: 'byTablePoints' },
  { sql: 'wm.window_points desc', ts: 'byWindowPoints' },
  { sql: 'wm.exacts desc', ts: 'byExacts' },
  { sql: 'wm.corrects desc', ts: 'byResults' },
  { sql: 'wm.mini_points desc', ts: 'const headToHead =' },
  { sql: 'wm.mini_difference desc', ts: 'headToHeadDifference' },
  { sql: '(wm.points_for - wm.points_against) desc', ts: 'byDifference' },
  { sql: 'wm.scoreline_error asc', ts: 'byError' },
  { sql: 'wm.draw_number asc', ts: 'drawNumber' },
] as const

describe('the group table exists in both languages', () => {
  it('finds the SQL body and the TypeScript comparator', () => {
    expect(groupTables, 'cup_final_group_tables body not found').not.toBe('')
    expect(seasonSource).toContain('const ranked =')
  })
})

describe('the tournament and season rank by the same nine keys', () => {
  it.each(RANKING.map((key, index) => [index + 1, key.sql, key.ts] as const))(
    'key %i is %s in SQL and %s in TypeScript',
    (_position, sqlKey, tsKey) => {
      expect(groupTables, `SQL is missing ${sqlKey}`).toContain(sqlKey)
      expect(comparator, `the comparator is missing ${tsKey}`).toContain(tsKey)
    },
  )

  it('orders them identically, which is the correction this file records', () => {
    const sqlPositions = RANKING.map((key) => groupTables.lastIndexOf(key.sql))
    const tsPositions = RANKING.map((key) => comparator.indexOf(key.ts))

    expect(sqlPositions.every((position) => position > -1)).toBe(true)
    expect(tsPositions.every((position) => position > -1)).toBe(true)
    expect(sqlPositions, 'the SQL ordering keys are out of their pinned sequence').toEqual(
      [...sqlPositions].sort((a, b) => a - b),
    )
    expect(tsPositions, 'the TypeScript comparator is out of its pinned sequence').toEqual(
      [...tsPositions].sort((a, b) => a - b),
    )
  })

  it('terminates on the draw number in both, so ranking is always total', () => {
    // Every entrant has a unique draw number, so ranking never falls back to
    // insertion order — which would make the table depend on row arrival.
    expect(RANKING.at(-1)?.sql).toBe('wm.draw_number asc')
    expect(seasonSource).toMatch(/guaranteed terminator/i)
    expect(comparator).toMatch(/return leftRecord\.drawNumber - rightRecord\.drawNumber/)
  })
})

describe('the ordering is not where the competitions differ', () => {
  it('keeps the wildcard normalisation out of the group table', () => {
    // §6.3 compares third-placed sides across differently sized groups. It is
    // in the qualification path, not here — the misattribution corrected at
    // PR #419.
    expect(groupTables).not.toMatch(/group_size - 1/)
    expect(allSql).toMatch(/gate\.table_points::numeric \/ \(gate\.group_size - 1\) desc/)
  })

  it('needs no season-specific group table, because this one is already neutral', () => {
    // Contract 75's split cascaded: the group table reaches the tournament only
    // through `cup_window_scores`, which is now competition-agnostic.
    for (const pattern of [
      /public\.matches\b/,
      /match_predictions\b/,
      /bonus_knockout_predictions\b/,
      /tournament_id/,
    ]) {
      expect(groupTables, `the group table still matches ${pattern}`).not.toMatch(pattern)
    }
  })
})
