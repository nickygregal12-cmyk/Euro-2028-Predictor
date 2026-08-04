import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20260804333000_competition_instance_lineage.sql'),
  'utf8',
)
const catalogue = readFileSync(
  resolve(root, 'scripts/bonus-games/publish-catalogue.sql'),
  'utf8',
)

describe('contract 103 competition-instance source boundaries', () => {
  it('keeps independent private series beside one live public season game', () => {
    expect(migration).toContain("visibility_kind in ('public', 'private')")
    expect(migration).toContain('bonus_competitions_live_series_key')
    expect(migration).toContain('bonus_competitions_live_public_game_key')
    expect(migration).toMatch(
      /where visibility_kind = 'public' and completed_at is null/i,
    )
  })

  it('keeps the operational catalogue on the live public instance', () => {
    expect(catalogue).toMatch(
      /on conflict \(tournament_id, game_key\)\s+where visibility_kind = 'public' and completed_at is null\s+do update/i,
    )
    expect(catalogue).not.toMatch(
      /on conflict \(tournament_id, game_key\) do update/i,
    )
    expect(catalogue.match(/competition\.visibility_kind = 'public'/g)?.length).toBe(6)
    expect(catalogue.match(/competition\.completed_at is null/g)?.length).toBe(6)
  })
})
