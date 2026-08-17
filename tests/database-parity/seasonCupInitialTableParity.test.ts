import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const migration = read('supabase/migrations/20260811200000_season_cup_initial_group_table.sql')
const tournamentSource = read('supabase/migrations/20260806150000_season_cup_split_transition.sql')
const phaseSource = read('supabase/migrations/20260806100000_season_cup_phase_read.sql')
const stageSource = read('supabase/migrations/20260811180000_cup_group_stage_read.sql')
const proof = read('supabase/tests/218_season_cup_initial_group_table.sql')

/**
 * The tie-break ORDER BY of a group table, normalised for whitespace. This is
 * what contract 124 established has to be compared rather than read: it
 * hand-reconstructed the tail of one of these functions and silently replaced
 * ADR 0014 §5.2's mini head-to-head with a different rule, and reading it
 * afterwards did not catch that.
 */
const tieBreakOrder = (source: string, functionName: string): string => {
  const start = source.indexOf(`create or replace function ${functionName}(`)
  expect(start, `${functionName} is not defined in this source`).toBeGreaterThan(-1)
  const body = source.slice(start)
  const match = body.match(/order by([\s\S]*?)\)::integer as group_rank/)
  expect(match, `${functionName} has no group_rank ordering`).not.toBeNull()
  return at(match!, 1).replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('contract 169 season Championship initial group table', () => {
  it('keeps the season table free of the tournament matchday bound', () => {
    const start = migration.indexOf(
      'create or replace function predictor_internal.cup_season_group_tables(',
    )
    const end = migration.indexOf(
      'revoke all on function predictor_internal.cup_season_group_tables(uuid)',
    )
    const seasonTable = migration.slice(start, end)

    // THE ASSERTION THIS FILE EXISTS FOR. `sequence between 1 and 3` is the
    // tournament's three group matchdays; a season group stage runs to
    // thirty-eight, and ranking one on the first three decides the group
    // winner wrongly — which decides qualification and seeding.
    expect(seasonTable).not.toMatch(/sequence\s+between/i)
    expect(seasonTable).not.toMatch(/sequence\s*<=?\s*3/i)

    // It measures the span it should: the windows of the entrant's own settled
    // group fixtures, which is contract 105's rule applied to the initial phase.
    expect(seasonTable).toContain('played_windows')
    expect(seasonTable).toContain('predictor_internal.cup_window_settled(fixture.window_id)')
    expect(seasonTable).toContain("member.phase_kind = 'initial'")
    expect(seasonTable).toContain("fixture.stage = 'group'")
  })

  it('leaves the tournament table exactly as it was', () => {
    // A settled, production-hosted authority does not change to fix a season.
    // Contract 124's redefinition is the live one and must remain the live one.
    expect(migration).not.toMatch(
      /create or replace function predictor_internal\.cup_final_group_tables/,
    )
    expect(tournamentSource).toContain('and win.sequence between 1 and 3')
  })

  it('carries ADR 0014 §5.2 across unchanged', () => {
    // Compared, not read. The two initial tables may differ only in the span
    // their middle keys are measured over — never in the key ORDER.
    const seasonOrder = tieBreakOrder(migration, 'predictor_internal.cup_season_group_tables')
    const tournamentOrder = tieBreakOrder(
      tournamentSource,
      'predictor_internal.cup_final_group_tables',
    )

    expect(seasonOrder).toBe(tournamentOrder)
    expect(seasonOrder).toContain('wm.table_points desc')
    expect(seasonOrder).toContain('wm.window_points desc')
    expect(seasonOrder).toContain('wm.mini_points desc')
    expect(seasonOrder).toContain('wm.draw_number asc')
  })

  it('routes both season reads through one decision point', () => {
    expect(migration).toContain('predictor_internal.cup_initial_group_tables')
    expect(migration).toContain('predictor_internal.cup_is_league_season')

    const phase = migration.slice(
      migration.indexOf('create or replace function public.get_season_cup_phase('),
      migration.indexOf('$get_season_cup_phase$;'),
    )
    const stage = migration.slice(
      migration.indexOf('create or replace function public.get_season_cup_group_stage('),
      migration.indexOf('$stage$;'),
    )

    // Neither season reader reaches the tournament table directly any more.
    expect(phase).not.toContain('cup_final_group_tables')
    expect(stage).not.toContain('cup_final_group_tables')
    expect(phase).toContain('cup_initial_group_tables')
    expect(stage).toContain('cup_initial_group_tables')

    // And the stage read does not decide the season question for itself:
    // two readers answering one question separately is the shape of the
    // defect this contract fixes.
    expect(stage).not.toContain('cup_is_league_season')

    // The split branch is untouched.
    expect(phase).toContain('cup_split_group_tables')
  })

  it('changes nothing else about the two reads it redefines', () => {
    const stage = migration.slice(
      migration.indexOf('create or replace function public.get_season_cup_group_stage('),
      migration.indexOf('$stage$;'),
    )
    const originalStage = stageSource.slice(
      stageSource.indexOf('create or replace function public.get_season_cup_group_stage('),
      stageSource.indexOf('$stage$;'),
    )

    // Byte-identical apart from the one substituted call.
    expect(stage.replace('cup_initial_group_tables', 'cup_final_group_tables')).toBe(
      originalStage,
    )

    // The phase read keeps its entrancy shape and its emitted keys, and gains
    // exactly one: which authority produced the table.
    expect(phaseSource).toContain("'entered', false")
    expect(migration).toContain("'entered', false")
    expect(migration).toContain("'table_source'")
    expect(migration).toContain("'season_initial'")
    expect(migration).toContain("'tournament_initial'")
  })

  it('grants the new internals to nobody and keeps the reads authenticated-only', () => {
    expect(migration).toContain(
      'revoke all on function predictor_internal.cup_season_group_tables(uuid)\n  from public, anon, authenticated, service_role;',
    )
    expect(migration).toContain(
      'revoke all on function predictor_internal.cup_initial_group_tables(uuid)\n  from public, anon, authenticated, service_role;',
    )
    expect(migration).toContain(
      'revoke all on function predictor_internal.cup_is_league_season(uuid)\n  from public, anon, authenticated, service_role;',
    )
    expect(migration).toContain(
      'grant execute on function public.get_season_cup_phase(uuid) to authenticated;',
    )
    expect(migration).toContain(
      'grant execute on function public.get_season_cup_group_stage(uuid, integer) to authenticated;',
    )
  })

  it('creates no relation and settles nothing', () => {
    expect(migration).not.toMatch(/^create table/im)
    expect(migration).not.toMatch(/^alter table/im)
    expect(migration).not.toMatch(/^create trigger/im)
    expect(migration).not.toMatch(/\binsert into\b/i)
    expect(migration).not.toMatch(/\bupdate public\./i)
  })

  it('proves the defect and the fix by execution rather than by assertion alone', () => {
    // The suite must drive a group stage LONGER than three matchdays, because
    // at three the defect is invisible by construction.
    expect(proof).toContain('generate_series(1, 6)')
    expect(proof).toContain('the group winner changes')
    expect(proof).toContain('an unsettled matchday contributes to neither key')
    expect(proof).toContain('the tournament table is unchanged')
  })
})
