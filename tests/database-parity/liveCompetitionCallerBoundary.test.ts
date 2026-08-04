import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260805001000_live_competition_callers.sql'),
  'utf8',
)
const normalizedMigration = migration.toLowerCase()

const targets = [
  'predictor_internal.enforce_season_matchweek_lock',
  'predictor_internal.prepare_competition_season_scope',
  'predictor_internal.recompute_ko_predictor_for_match',
  'predictor_internal.recompute_lms_for_tournament',
  'public.create_league',
  'public.get_bonus_games',
  'public.get_competition_games',
  'public.get_ko_predictor_standings',
  'public.get_my_cup',
  'public.get_my_lms',
] as const

describe('contract 104 live competition caller boundary', () => {
  it('redefines exactly the ten measured callers', () => {
    expect(migration.match(/create\s+or\s+replace\s+function/gi)).toHaveLength(10)
    for (const target of targets) {
      expect(normalizedMigration).toContain(`function ${target}`)
    }
  })

  it('uses the one contract-103 resolver once in every caller', () => {
    expect(migration.match(/predictor_internal\.live_competition_id\(/g)).toHaveLength(10)
  })

  it('does not add a lifecycle driver or rewrite direct competition-id ownership', () => {
    expect(migration).not.toContain('restart_all_reentered')
    expect(migration).not.toContain('predecessor_competition_id')
    expect(migration).toContain('from public.bonus_competitions where id = new.competition_id')
  })

  it('keeps publication gates on public read surfaces', () => {
    expect(migration.match(/competition\.published/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
