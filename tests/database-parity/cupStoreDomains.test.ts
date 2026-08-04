import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CUP_GROUP_CAP } from '../../src/domain/season/cupFormat'

/**
 * The shared Cup store's column domains, and the compensating control for
 * widening them.
 *
 * Contract 79 relaxed two CHECK constraints that encoded the TOURNAMENT's
 * format on tables C1b made shared: `bonus_cup_groups.size in (3, 4)` and
 * `bonus_cup_fixtures.matchday between 1 and 3`. A season group runs to twenty
 * entrants over a league phase of many rounds, so neither domain could hold.
 *
 * THE ARGUMENT FOR WIDENING is that these are format rules, not integrity
 * rules. The tournament's correctness never rested on them:
 * `admin_draw_predictor_cup` computes its own group sizes and writes its own
 * matchdays. Widening the column cannot make the tournament wrong, because the
 * tournament never asks the column for permission.
 *
 * THE RISK is that the argument stops being true — that someone later changes
 * the tournament draw, and the CHECK that used to catch it is gone. So this
 * file pins the limit where it now lives: in the code that owns the tournament
 * format. If the draw ever writes a group size other than three or four, or a
 * matchday outside one to three, that is a change to the tournament's format
 * and must be a visible edit rather than something a relaxed constraint let
 * through.
 *
 * What this cannot check, stated so the coverage is not overread: it reads SQL
 * text, so it proves what the draw is written to do rather than what a live
 * database contains. `108`–`114_predictor_cup_*.sql` remain the behavioural
 * evidence, and `131_cup_store_domains.sql` runs the widened domains against a
 * real database.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
const allSql = migrationFiles
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

const drawBody =
  /create or replace function public\.admin_draw_predictor_cup\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(
    allSql,
  )?.[1] ?? ''

const widening =
  readFileSync(
    resolve(migrationsDirectory, '20260804063000_cup_store_competition_domains.sql'),
    'utf8',
  ) ?? ''

describe('the shared store no longer carries the tournament format', () => {
  it('bounds group size by the platform cap rather than the tournament shape', () => {
    expect(CUP_GROUP_CAP).toBe(20)
    expect(widening).toMatch(
      new RegExp(`add constraint bonus_cup_groups_size_allowed\\s*\\n?\\s*check \\(size between 3 and ${CUP_GROUP_CAP}\\)`),
    )
    // The tournament-only domain must be gone, not merely joined by a wider one.
    expect(widening).toMatch(/drop constraint if exists bonus_cup_groups_size_check/)
  })

  it('bounds matchday below only, because the ceiling is a format decision', () => {
    // Twenty entrants over three meetings is fifty-seven rounds. A number
    // pinned in the column would be a second, weaker copy of the format rule.
    expect(widening).toMatch(/check \(matchday is null or matchday > 0\)/)
    expect(widening).toMatch(/drop constraint if exists bonus_cup_fixtures_matchday_check/)
  })

  it('proves the end state rather than trusting the drops to have matched', () => {
    // `drop constraint if exists` is silent on a wrong name, which would leave
    // the old domain in place and the migration reporting success. Removing
    // this block makes a typo'd drop pass unnoticed.
    expect(widening).toMatch(/the tournament-only group-size domain survived the widening/)
    expect(widening).toMatch(/the tournament-only matchday domain survived the widening/)
    expect(widening).toMatch(/the widened group-size constraint is missing/)
    expect(widening).toMatch(/the widened matchday constraint is missing/)
  })

  it('leaves the stage enum alone, deliberately', () => {
    // A season split stage would immediately violate
    // `bonus_cup_fixtures_group_shape`, which requires a non-group stage to
    // carry neither group_id nor matchday while split rounds need both.
    // Widening the enum alone buys a constraint violation, not a feature.
    expect(widening).not.toMatch(/stage in \('group', 'playoff', 'knockout', /)
    expect(widening).toMatch(/STAGE IS DELIBERATELY NOT WIDENED/)
  })
})

describe('the tournament keeps its own limits, now that the column does not', () => {
  it('finds the draw', () => {
    expect(drawBody, 'admin_draw_predictor_cup body not found').not.toBe('')
  })

  it('still writes only groups of three or four', () => {
    // The whole justification for relaxing the column. If this changes, the
    // tournament's format changed, and that must be deliberate.
    expect(drawBody).toMatch(/v_size := case when g <= v_fours then 4 else 3 end/)
  })

  it('still writes only matchdays one to three', () => {
    const matchdays = [...drawBody.matchAll(/v_window_ids\[(\d+)\], (\d+),/g)].map((match) =>
      Number(match[2]),
    )
    expect(matchdays.length, 'no tournament matchdays found to check').toBeGreaterThan(0)
    for (const matchday of matchdays) {
      expect(matchday, `the tournament draw writes matchday ${matchday}`).toBeGreaterThanOrEqual(1)
      expect(matchday, `the tournament draw writes matchday ${matchday}`).toBeLessThanOrEqual(3)
    }
  })

  it('keeps the tournament schedule hardcoded rather than adopting the circle method', () => {
    // Contract 78 established these are not interchangeable: the circle method
    // produces the same pairings in a different round order, so swapping them
    // would move published fixtures.
    expect(drawBody).toMatch(/insert into public\.bonus_cup_fixtures/)
    expect(drawBody).not.toMatch(/cup_league_schedule/)
  })
})
