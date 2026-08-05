import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260805010000_cup_split_group_tables.sql'),
  'utf8',
)
const proof = readFileSync(
  resolve(process.cwd(), 'supabase/tests/156_cup_split_group_tables.sql'),
  'utf8',
)

describe('contract 105 Cup split boundary', () => {
  it('keeps the migration atomic and internal-only', () => {
    expect(migration.match(/^begin;$/gm)).toHaveLength(1)
    expect(migration.match(/^commit;$/gm)).toHaveLength(1)
    expect(migration).toContain('predictor_internal.cup_split_group_tables')
    expect(migration).toContain('predictor_internal.assert_bonus_cup_member_split_parent')
    expect(migration).toContain(
      'revoke all on function predictor_internal.cup_split_group_tables(uuid)',
    )
  })

  it('derives carry-forward rather than storing a starting total', () => {
    expect(migration).toContain("fixture.stage in ('group', 'split')")
    expect(migration).not.toMatch(/starting[_ ]points|carried[_ ]points/i)
    expect(migration).not.toMatch(/alter table[^;]+add column[^;]+points/is)
  })

  it('enforces one-parent split ancestry at the member boundary', () => {
    expect(migration).toContain(
      'A split Cup member must come from the split group parent',
    )
    expect(migration).toContain('A populated split Cup group cannot change parent')
    expect(migration).toContain('Initial Cup membership cannot move after the split')
    expect(migration).toContain('Initial Cup membership is permanent')
    expect(migration).toContain('create trigger assert_bonus_cup_member_split_parent')
  })

  it('proves a valid single-parent split and refuses cross-parent membership', () => {
    expect(proof.match(/md5\('c5-initial'\)::uuid/g)?.length).toBeGreaterThan(5)
    expect(proof).toContain("md5('c5-other-initial')::uuid")
    expect(proof).toContain(
      'a split group refuses an entrant whose initial membership belongs to another parent',
    )
    expect(proof).not.toContain('cuts ACROSS the initial groups')
  })

  it('pins the correction-after-split evidence that distinguishes derived from copied', () => {
    expect(proof).toContain('correct_match_result')
    expect(proof).toContain('AFTER the split')
    expect(proof).toContain('which a stored starting total could not have done')
  })
})
