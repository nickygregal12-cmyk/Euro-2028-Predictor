import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260805001000_live_competition_callers.sql'),
  'utf8',
)
const proof = readFileSync(
  resolve(process.cwd(), 'supabase/tests/155_live_competition_callers.sql'),
  'utf8',
)
const normalizedMigration = migration.toLowerCase()

const operationalTargets = [
  'predictor_internal.enforce_season_matchweek_lock',
  'predictor_internal.prepare_competition_season_scope',
  'predictor_internal.recompute_ko_predictor_for_match',
  'predictor_internal.recompute_lms_for_tournament',
  'public.create_league',
] as const
const readTargets = [
  'public.get_bonus_games',
  'public.get_competition_games',
  'public.get_ko_predictor_standings',
  'public.get_my_cup',
  'public.get_my_lms',
] as const

describe('contract 104 competition-instance caller boundary', () => {
  it('moves the caller set atomically', () => {
    expect(normalizedMigration.match(/^begin;$/gm)).toHaveLength(1)
    expect(normalizedMigration.match(/^commit;$/gm)).toHaveLength(1)
    expect(normalizedMigration.indexOf('begin;')).toBeLessThan(
      normalizedMigration.indexOf('function predictor_internal.current_public_competition_id'),
    )
    expect(normalizedMigration.lastIndexOf('commit;')).toBeGreaterThan(
      normalizedMigration.lastIndexOf('function public.get_my_lms'),
    )
  })

  it('redefines ten callers and one internal current-read helper', () => {
    expect(migration.match(/create\s+or\s+replace\s+function/gi)).toHaveLength(11)
    expect(normalizedMigration).toContain(
      'function predictor_internal.current_public_competition_id',
    )
    for (const target of [...operationalTargets, ...readTargets]) {
      expect(normalizedMigration).toContain(`function ${target}`)
    }
  })

  it('keeps operational paths live-only and reads terminal-aware', () => {
    expect(migration.match(/predictor_internal\.live_competition_id\(/g)).toHaveLength(6)
    expect(
      migration.match(/predictor_internal\.current_public_competition_id\(/g),
    ).toHaveLength(7)
  })

  it('does not add a lifecycle driver or rewrite direct competition-id ownership', () => {
    expect(migration).not.toContain('restart_all_reentered')
    expect(migration).not.toContain('public_wipeout_restart')
    expect(migration).toContain('from public.bonus_competitions where id = new.competition_id')
  })

  it('retains Contract 102 initial-phase Cup membership', () => {
    const cupStart = normalizedMigration.indexOf('function public.get_my_cup')
    const cupEnd = normalizedMigration.indexOf('-- public.get_my_lms', cupStart)
    const cup = normalizedMigration.slice(cupStart, cupEnd)
    expect(cup.match(/member\.phase_kind = 'initial'/g)).toHaveLength(2)
  })

  it('keeps publication gates on public read surfaces', () => {
    expect(migration.match(/competition\.published/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('builds the predecessor probe from canonical LMS state, not seed publication state', () => {
    expect(proof).toContain("competition.game_key = 'last_man_standing'")
    expect(proof).not.toContain('and competition.published\n  order by competition.game_key')
    expect(proof).toMatch(
      /set published = true,\s+availability_status = 'active',\s+completed_at = now\(\)/,
    )
  })
})
