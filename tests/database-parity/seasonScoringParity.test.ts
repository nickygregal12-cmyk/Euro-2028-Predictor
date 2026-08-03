import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SEASON_PREDICTOR_POINTS,
  scoreFixture,
  scoreMatchweek,
} from '../../src/domain/season/scoring'

/**
 * ADR 0012 requires an independent season scoring authority with
 * TypeScript/PostgreSQL parity. This holds the two in step, in the family of
 * `scoringValueParity` for the tournament.
 *
 * The failure this exists to catch is quiet. If the SQL stacked exact-score on
 * top of correct-result it would award 8 instead of 5, every league table would
 * be wrong, and nothing else would complain — the numbers would still look like
 * points. So the values are read out of the SQL and compared to the TypeScript
 * constants rather than to a second copy of the same literals.
 *
 * Text-based over the committed migration, so it needs no database. The
 * behaviour is proven against a real one in `122_season_scoring.sql`.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

const fixturePoints =
  /season_fixture_points\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''
const matchweekPoints =
  /season_matchweek_points\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''

describe('the SQL counterpart exists', () => {
  it('finds both function bodies', () => {
    expect(fixturePoints, 'season_fixture_points body not found').not.toBe('')
    expect(matchweekPoints, 'season_matchweek_points body not found').not.toBe('')
  })
})

describe('the two authorities award the same points', () => {
  it('agrees on the exact-score value', () => {
    expect(SEASON_PREDICTOR_POINTS.exactScore).toBe(5)
    expect(fixturePoints).toMatch(
      new RegExp(`then ${SEASON_PREDICTOR_POINTS.exactScore}\\b`),
    )
  })

  it('agrees on the correct-result value', () => {
    expect(SEASON_PREDICTOR_POINTS.correctResult).toBe(3)
    expect(fixturePoints).toMatch(
      new RegExp(`then ${SEASON_PREDICTOR_POINTS.correctResult}\\b`),
    )
  })

  it('replaces rather than stacks, and orders the branches to prove it', () => {
    // TypeScript returns early on an exact hit. SQL CASE takes the first
    // matching branch, so the exact test must come first: with the outcome
    // branch first, a perfect prediction would score 3.
    expect(scoreFixture({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(5)

    const exactBranch = fixturePoints.indexOf('p_prediction_home = p_result_home')
    const outcomeBranch = fixturePoints.indexOf('sign(p_prediction_home')

    expect(exactBranch).toBeGreaterThan(-1)
    expect(outcomeBranch).toBeGreaterThan(-1)
    expect(
      exactBranch,
      'the outcome branch precedes the exact branch, so an exact score would award 3',
    ).toBeLessThan(outcomeBranch)

    // And the sum of the two values never appears, which is what stacking
    // would produce.
    const stacked = SEASON_PREDICTOR_POINTS.exactScore + SEASON_PREDICTOR_POINTS.correctResult
    expect(fixturePoints).not.toMatch(new RegExp(`then ${stacked}\\b`))
  })
})

describe('unknown data never awards points', () => {
  it.each([
    ['a missing prediction', null],
    ['a malformed prediction', { home: -1, away: 0 }],
  ])('%s scores zero in TypeScript', (_label, prediction) => {
    expect(scoreFixture(prediction as never, { home: 1, away: 0 })).toBe(0)
  })

  it('guards the same cases in SQL', () => {
    expect(fixturePoints).toContain('p_prediction_home is null')
    expect(fixturePoints).toContain('p_result_home is null')
    expect(fixturePoints).toContain('p_prediction_home < 0')
    expect(fixturePoints).toContain('p_result_home < 0')
  })
})

describe('the Joker doubles the matchweek, not the fixture', () => {
  it('doubles the total once in TypeScript', () => {
    const fixtures = [
      { prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } },
      { prediction: { home: 1, away: 1 }, result: { home: 0, away: 0 } },
    ]
    const plain = scoreMatchweek(fixtures, false)
    const doubled = scoreMatchweek(fixtures, true)

    expect(plain.totalPoints).toBe(8)
    expect(doubled.totalPoints).toBe(16)
  })

  it('applies the multiplier to the sum in SQL, not inside it', () => {
    // Doubling per fixture gives the same answer for one fixture and a
    // different one for two, which is exactly the bug that survives a
    // single-fixture test.
    const sumAt = matchweekPoints.indexOf('sum(')
    const multiplierAt = matchweekPoints.indexOf('then 2')

    expect(sumAt).toBeGreaterThan(-1)
    expect(multiplierAt).toBeGreaterThan(sumAt)
    expect(matchweekPoints).toMatch(/\)::integer\s*\n?\s*\* case/)
  })
})

describe('only a settled fixture scores', () => {
  it('counts played fixtures alone', () => {
    // Contract 68 refuses to store a scoreline on an abandoned fixture, so
    // "played" is the only state that can carry a result.
    expect(matchweekPoints).toContain("fixture.status = 'played'")
  })

  it('keeps an unpredicted fixture as a zero rather than dropping it', () => {
    expect(matchweekPoints).toContain('left join public.season_predictions')
  })
})

describe('the scoring surface stays server-side', () => {
  it('is revoked from every browser role', () => {
    expect(allSql).toMatch(
      /revoke all on function predictor_internal\.season_fixture_points[\s\S]*?from public, anon, authenticated/,
    )
    expect(allSql).toMatch(
      /revoke all on function predictor_internal\.season_matchweek_points[\s\S]*?from public, anon, authenticated/,
    )
  })
})
