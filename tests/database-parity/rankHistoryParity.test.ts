import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MATCHDAY_POINTS } from '../../src/domain/tournament/rankHistory'
import { at } from '../support/indexed'

/**
 * Static TypeScript/PostgreSQL parity for the rank-history matchday mapping.
 *
 * `src/domain/tournament/rankHistory.ts` states the mapping is "mirrored in the
 * migration", and `20260720180000_add_rank_history.sql` defines the same seven
 * rows as an inline `VALUES` list inside `capture_rank_history()`. Nothing
 * verified the two agree.
 *
 * The mapping decides which matchday a snapshot is filed under and its x-axis
 * order, so a divergence would either misplace a captured rank or skip a
 * snapshot: `matchday_key` is part of the insert-once unique constraint, and a
 * key present on one side only would silently never capture.
 *
 * The SQL copy is duplicated — `20260720180000_add_rank_history.sql` and
 * `20260728122500_h2h_rank_history.sql` each carry the same seven rows — so the
 * mapping lives in three places. Every copy is therefore checked against the
 * TypeScript one individually rather than pooled, which also catches one SQL
 * copy drifting from the other.
 *
 * Text-based, so it needs no database and runs in ordinary CI.
 */

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')

type MatchdayRow = {
  key: string
  ord: number
  round: string
  matchday: number | null
}

/**
 * Parses the `(key, ord, round, md)` VALUES rows from `capture_rank_history()`.
 * Postgres casts (`'MD1'::text`, `1::smallint`, `null::smallint`) are stripped.
 */
function sqlMatchdayRowsByMigration(): { file: string; rows: MatchdayRow[] }[] {
  const copies: { file: string; rows: MatchdayRow[] }[] = []

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8')
    if (!sql.includes('capture_rank_history')) continue

    const rows = [
      ...sql.matchAll(
        /\(\s*'([A-Z0-9]+)'(?:::text)?\s*,\s*(\d+)(?:::smallint)?\s*,\s*'([a-z0-9]+)'(?:::text)?\s*,\s*(null|\d+)(?:::smallint)?\s*\)/g,
      ),
    ].map((match) => ({
      key: at(match, 1),
      ord: Number(at(match, 2)),
      round: at(match, 3),
      matchday: at(match, 4) === 'null' ? null : Number(at(match, 4)),
    }))

    if (rows.length > 0) copies.push({ file, rows })
  }

  return copies
}

const expectedRows: MatchdayRow[] = MATCHDAY_POINTS.map((point) => ({
  key: point.key,
  ord: point.ord,
  round: point.round,
  matchday: point.matchday,
}))

describe('rank-history matchday mapping parity between TypeScript and PostgreSQL', () => {
  it('finds at least one SQL copy of the mapping', () => {
    // Guards the parser: an empty result would make the comparisons vacuous.
    const copies = sqlMatchdayRowsByMigration()

    expect(copies.length).toBeGreaterThan(0)
    expect(copies.map(({ file }) => file)).toContain(
      '20260720180000_add_rank_history.sql',
    )
  })

  it.each(sqlMatchdayRowsByMigration().map(({ file }) => file))(
    'matches the TypeScript mapping in %s',
    (file) => {
      const copy = sqlMatchdayRowsByMigration().find((c) => c.file === file)

      expect(copy?.rows.map((row) => row.key)).toEqual(
        expectedRows.map((row) => row.key),
      )
      expect(copy?.rows).toEqual(expectedRows)
    },
  )

  it('numbers the ordinals contiguously from one', () => {
    // The ordinal is the graph's x-axis position; a gap or repeat would reorder
    // or collide points on both sides at once.
    expect(MATCHDAY_POINTS.map((point) => point.ord)).toEqual(
      MATCHDAY_POINTS.map((_, index) => index + 1),
    )
  })
})
