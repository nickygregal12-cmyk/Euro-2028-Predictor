import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEASON_JOKERS_PER_HALF,
  SEASON_JOKERS_PER_SEASON,
  seasonJokerAllowance,
} from '../../src/domain/season/scoring'

/**
 * The season Joker allowance exists twice: in `src/domain/season/scoring.ts`
 * and in `predictor_internal.assert_season_joker_allowance`. ADR 0012 requires
 * TypeScript/PostgreSQL parity for season scoring, and a Joker doubles a whole
 * matchweek, so a disagreement is worth double points to whoever finds it.
 *
 * The values are asserted rather than assumed, and so is the half boundary —
 * the first draft of the SQL refused odd matchweek counts while the TypeScript
 * accepted them via `Math.floor(count / 2)`. That would have made a post-split
 * calendar impossible to run, and no test then existed to say so.
 *
 * Text-based over the committed migration, so it needs no database.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

const allowance = /assert_season_joker_allowance\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''

describe('the SQL counterpart exists and is readable', () => {
  it('finds the allowance function body', () => {
    expect(allowance, 'assert_season_joker_allowance body not found').not.toBe('')
    expect(allowance).toContain('v_half_size')
  })
})

describe('the two authorities agree on the allowance', () => {
  it('caps the season at the same number', () => {
    expect(SEASON_JOKERS_PER_SEASON).toBe(10)
    expect(allowance).toMatch(
      new RegExp(`v_used_in_season >= ${SEASON_JOKERS_PER_SEASON}\\b`),
    )
  })

  it('caps each half at the same number', () => {
    expect(SEASON_JOKERS_PER_HALF).toBe(5)
    expect(allowance).toMatch(new RegExp(`v_used_in_half >= ${SEASON_JOKERS_PER_HALF}\\b`))
  })

  it('caps the half separately from the season, which is what stops carry-over', () => {
    // Capping only the season total would let an unused first-half Joker
    // become an eleventh chance in the second half.
    expect(allowance).toContain('v_used_in_season')
    expect(allowance).toContain('v_used_in_half')
    expect(allowance).toContain('do not carry over')
  })
})

describe('the two authorities agree on where the halves divide', () => {
  it('uses floor(count / 2) rather than requiring an even season', () => {
    // PostgreSQL integer division truncates toward zero, which equals floor for
    // a positive count — so `v_matchweeks / 2` and `Math.floor(count / 2)` are
    // the same derivation.
    expect(allowance).toMatch(/v_half_size\s*:=\s*v_matchweeks\s*\/\s*2/)
    expect(allowance, 'an even-season requirement would refuse a post-split calendar').not.toMatch(
      /v_matchweeks\s*%\s*2/,
    )
  })

  it.each([
    [38, 19],
    [36, 18],
    [33, 16],
    [2, 1],
  ])('a %i matchweek season divides at %i in TypeScript', (count, boundary) => {
    expect(seasonJokerAllowance(count)?.firstHalfLastMatchweek).toBe(boundary)
  })

  it('refuses below two matchweeks on both sides', () => {
    expect(seasonJokerAllowance(1)).toBeNull()
    expect(seasonJokerAllowance(0)).toBeNull()
    expect(allowance).toMatch(/v_matchweeks\s*<\s*2/)
  })

  it('compares a candidate matchweek to the boundary the same way', () => {
    // TypeScript treats matchweeks above `firstHalfLastMatchweek` as the second
    // half; the SQL groups by `ordinal > v_half_size`. Both put the boundary
    // matchweek itself in the first half.
    const boundary = seasonJokerAllowance(38)!.firstHalfLastMatchweek
    expect(boundary).toBe(19)
    expect(allowance).toMatch(/round\.ordinal > v_half_size\)\s*=\s*\(v_ordinal > v_half_size/)
  })
})

describe('the Joker attaches to a matchweek, not a fixture', () => {
  it('keys the relation by round rather than by prediction', () => {
    // A per-fixture flag cannot express "this whole matchweek is doubled", and
    // would lose the Joker if a fixture were postponed out of the matchweek.
    expect(allSql).toMatch(/create table public\.season_matchweek_jokers/)
    expect(allSql).toMatch(/unique \(entry_id, competition_round_id\)/)
    expect(allowance).toContain("'league_matchweek'")
  })
})
