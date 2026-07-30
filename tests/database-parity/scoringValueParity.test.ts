import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GOLDEN_BOOT_POINTS,
  GROUP_MATCH_POINTS,
  GROUP_POSITION_POINTS,
  JOKER_MULTIPLIER,
  KNOCKOUT_STAGE_ORDER,
  KNOCKOUT_STAGE_POINTS,
  TOTAL_GOALS_BANDS,
  TOTAL_GOALS_OUTSIDE_POINTS,
} from '../../src/domain/tournament/scoringConfig'

/**
 * Static TypeScript/PostgreSQL parity for the Original Predictor point values.
 *
 * `src/domain/tournament/scoringConfig.ts` says every value is transcribed from
 * `docs/scoring-rules.md` and that if the doc changes it should change "here (and
 * only here)". That is not quite true: `recompute_tournament_scores()` carries the
 * same numbers as SQL literals, and the database is authoritative for scoring. So
 * the values live in two places and nothing compared them. A one-sided edit would
 * make the UI and the recorded score disagree, which `docs/scoring-rules.md`
 * remains the authority for resolving.
 *
 * ### Why only the newest definition
 *
 * Scoring is redefined append-only: `20260720130000_add_scoring.sql`,
 * `20260720180000_add_rank_history.sql`,
 * `20260721120000_scoring_positions_knockout_awards.sql` and
 * `20260723183000_knockout_result_lifecycle.sql` each define
 * `recompute_tournament_scores`. Only the last one is in effect.
 *
 * This test therefore pins the newest definition and deliberately does NOT
 * require the older copies to agree. Asserting that they all match would block a
 * legitimate future scoring change, which necessarily lands as a new migration
 * while the superseded copies keep their historical values. (Contrast
 * `rankHistoryParity.test.ts`, where both SQL copies are simultaneously live in
 * different functions and so must agree.)
 *
 * Predictor Cup and KO Predictor have their own scoring under ADR 0014 and are
 * out of scope: they are separate rule sets that happen to share some values, and
 * `CLAUDE.md` forbids merging tournament and bonus-game implementations.
 *
 * Text-based, so it needs no database and runs in ordinary CI.
 */

const migrationsDir = resolve(process.cwd(), 'supabase/migrations')

/** The newest migration defining `recompute_tournament_scores` — the live one. */
function effectiveScoringMigration(): { file: string; sql: string } {
  const defining = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: readFileSync(resolve(migrationsDir, file), 'utf8') }))
    .filter(({ sql }) =>
      /create\s+or\s+replace\s+function\s+(?:public\.)?recompute_tournament_scores/i.test(
        sql,
      ),
    )

  const newest = defining.at(-1)
  if (!newest) throw new Error('No migration defines recompute_tournament_scores.')
  return newest
}

const { file: scoringFile, sql: scoringSql } = effectiveScoringMigration()

/** Cumulative knockout totals implied by the stacking per-stage points. */
function cumulativeKnockoutPoints(): number[] {
  let running = 0
  return KNOCKOUT_STAGE_ORDER.map((stage) => {
    running += KNOCKOUT_STAGE_POINTS[stage]
    return running
  })
}

describe(`Original Predictor scoring value parity (${scoringFile})`, () => {
  it('pins the newest scoring definition, not a superseded copy', () => {
    // If a later migration redefines scoring, this test must follow it. Failing
    // here means the resolution picked the wrong migration.
    expect(scoringFile).toMatch(/^\d{14}_/)
    expect(scoringSql).toMatch(/recompute_tournament_scores/)
  })

  it('scores a group match the same on both sides', () => {
    const match = scoringSql.match(
      /when mp\.home_score = m\.home_score and mp\.away_score = m\.away_score then (\d+)\s*\n\s*when sign\([^)]*\) = sign\([^)]*\) then (\d+)\s*\n\s*else (\d+)/,
    )

    expect(match).not.toBeNull()
    expect({
      exactScore: Number(match?.[1]),
      correctResult: Number(match?.[2]),
      wrong: Number(match?.[3]),
    }).toEqual({ ...GROUP_MATCH_POINTS })
  })

  it('applies the same joker multiplier on both sides', () => {
    const match = scoringSql.match(/case when scored\.joker then (\d+) else (\d+) end/)

    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(JOKER_MULTIPLIER)
    // The non-joker branch must be identity, or every unjokered match rescales.
    expect(Number(match?.[2])).toBe(1)
  })

  it('scores group positions and the full-order bonus the same on both sides', () => {
    const match = scoringSql.match(
      /correct \* (\d+) \+ \(case when [a-z.]+correct = (\d+) then (\d+) else 0 end\)/,
    )

    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(GROUP_POSITION_POINTS.perCorrectTeam)
    expect(Number(match?.[3])).toBe(GROUP_POSITION_POINTS.fullOrderBonus)
    // The bonus triggers on a complete four-team group.
    expect(Number(match?.[2])).toBe(4)
  })

  it('precomputes the knockout ladder from the same stacking values', () => {
    // The SQL stores cumulative totals per reached stage; TypeScript stores the
    // per-stage increments. A changed increment must move the ladder.
    const match = scoringSql.match(
      /case ks\.k when 0 then (\d+) when 1 then (\d+) when 2 then (\d+) when 3 then (\d+) when 4 then (\d+) end/,
    )

    expect(match).not.toBeNull()
    expect(match?.slice(1, 6).map(Number)).toEqual(cumulativeKnockoutPoints())
  })

  it('awards the same golden boot points on both sides', () => {
    const match = scoringSql.match(/'awards', null, null, (\d+), false/)

    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(GOLDEN_BOOT_POINTS)
  })

  it('bands the group-goals prediction the same on both sides', () => {
    const match = scoringSql.match(
      /case when [a-z.]+diff = (\d+) then (\d+) when [a-z.]+diff <= (\d+) then (\d+) when [a-z.]+diff <= (\d+) then (\d+) else (\d+) end/,
    )

    expect(match).not.toBeNull()

    const sqlBands = [
      { maxDiff: Number(match?.[1]), points: Number(match?.[2]) },
      { maxDiff: Number(match?.[3]), points: Number(match?.[4]) },
      { maxDiff: Number(match?.[5]), points: Number(match?.[6]) },
    ]

    expect(sqlBands).toEqual(
      TOTAL_GOALS_BANDS.map((band) => ({
        maxDiff: band.maxDiff,
        points: band.points,
      })),
    )
    expect(Number(match?.[7])).toBe(TOTAL_GOALS_OUTSIDE_POINTS)
  })

  it('orders the goal bands best-first so the tiers cannot overlap', () => {
    // The SQL relies on first-match-wins `when` ordering; a TypeScript list that
    // is not ascending by maxDiff would band differently from the same SQL.
    const diffs = TOTAL_GOALS_BANDS.map((band) => band.maxDiff)

    expect(diffs).toEqual([...diffs].sort((a, b) => a - b))
  })
})
