import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CUP_GROUP_CAP } from '../../src/domain/season/cupFormat'

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const migrationPath = resolve(
  migrationsDirectory,
  '20260804323000_cup_split_stage_persistence.sql',
)
const migration = readFileSync(migrationPath, 'utf8')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

const tournamentDraw =
  /create or replace function public\.admin_draw_predictor_cup\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(
    allSql,
  )?.[1] ?? ''

describe('contract 102 persists the split as a real phase', () => {
  it('adds phase and parentage to groups without rewriting existing history', () => {
    expect(migration.match(/add column phase_kind text not null default 'initial'/g)).toHaveLength(
      2,
    )
    expect(migration).toContain('add column parent_group_id uuid')
    expect(migration).toMatch(/phase_kind in \('initial', 'split'\)/)
    expect(migration).toMatch(/phase_kind = 'initial' and parent_group_id is null/)
    expect(migration).toMatch(/phase_kind = 'split' and parent_group_id is not null/)
    expect(migration).toContain('A split Cup group must point directly to an initial-phase group')
    expect(migration).toContain('same competition')
  })

  it('makes membership phase-aware while preserving the initial row', () => {
    expect(migration).toMatch(
      /primary key \(competition_id, user_id, phase_kind\)/,
    )
    expect(migration).toMatch(
      /unique \(competition_id, phase_kind, draw_number\)/,
    )
    expect(migration).toMatch(
      /foreign key \(competition_id, group_id, phase_kind\)[\s\S]*references public\.bonus_cup_groups \(competition_id, id, phase_kind\)/,
    )
    expect(migration).toMatch(
      /phase_kind = 'initial'[\s\S]*group_position is null and qualified_as is null and seed is null/,
    )
  })

  it('widens the shared group-position domain to the same platform cap as group size', () => {
    expect(CUP_GROUP_CAP).toBe(20)
    expect(migration).toMatch(
      new RegExp(`group_position is null or group_position between 1 and ${CUP_GROUP_CAP}`),
    )
    expect(migration).toContain('drop constraint if exists bonus_cup_members_group_position_check')
  })

  it('stores split fixtures as group-shaped and never as knockout-shaped', () => {
    expect(migration).toMatch(
      /stage in \('group', 'split', 'playoff', 'knockout'\)/,
    )
    expect(migration).toMatch(
      /stage in \('group', 'split'\) and group_id is not null and matchday is not null/,
    )
    expect(migration).toMatch(
      /stage in \('playoff', 'knockout'\) and group_id is null and matchday is null/,
    )
    expect(migration).toMatch(
      /stage in \('group', 'split'\) and round_size is null and bracket_slot is null/,
    )
    expect(migration).toMatch(
      /stage not in \('group', 'split'\)[\s\S]*winner_user_id is null/,
    )
    expect(migration).toContain(
      'A split-stage Cup fixture must reference a split-phase group',
    )
  })

  it('keeps matchday unique across both league-like phases', () => {
    const phaseIndexPredicates =
      migration.match(/where stage in \('group', 'split'\)/g) ?? []
    expect(phaseIndexPredicates).toHaveLength(2)
  })

  it('does not store copied carry-forward arithmetic', () => {
    expect(migration).not.toMatch(
      /add column (carried_points|starting_points|points_carried)/,
    )
    expect(migration).toContain(
      'Split points must be derived from fixtures, never copied into storage',
    )
  })
})

describe('the existing tournament Cup remains initial-phase only', () => {
  it('continues to rely on the initial defaults rather than changing its draw', () => {
    expect(tournamentDraw, 'admin_draw_predictor_cup body not found').not.toBe('')
    expect(tournamentDraw).toContain(
      'insert into public.bonus_cup_groups (competition_id, ordinal, size)',
    )
    expect(tournamentDraw).toContain(
      'insert into public.bonus_cup_members (competition_id, user_id, group_id, draw_number)',
    )
    expect(tournamentDraw).not.toMatch(/insert into public\.bonus_cup_groups[^;]*phase_kind/)
    expect(tournamentDraw).not.toMatch(/insert into public\.bonus_cup_members[^;]*phase_kind/)
  })

  it('uses the permanent initial roster once when calculating prediction points', () => {
    for (const signature of [
      'predictor_internal.cup_tournament_fixture_points(uuid,uuid)',
      'predictor_internal.cup_season_fixture_points(uuid,uuid)',
      'predictor_internal.cup_final_group_tables(uuid)',
    ]) {
      expect(migration).toContain(signature)
    }
    expect(migration.match(/member\.phase_kind = ''initial''/g)?.length ?? 0).toBeGreaterThan(5)
  })

  it('excludes the split from knockout finalisation, settlement and Penalty Numbers', () => {
    expect(migration.match(/stage in \(''playoff'', ''knockout''\)/g)?.length ?? 0).toBeGreaterThan(
      2,
    )
    expect(migration).toContain('Predictor Cup group finalisation was not made split-safe')
    expect(migration).toContain('Predictor Cup round settlement was not made split-safe')
    expect(migration).toContain('Penalty Number submission was not made split-safe')
  })
})
