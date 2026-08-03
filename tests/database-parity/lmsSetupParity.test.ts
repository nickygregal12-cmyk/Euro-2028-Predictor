import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LMS_MAX_LIVES,
  LMS_MAX_SAVES,
  lmsPreset,
  publicLmsSetup,
  validateLmsSetup,
} from '../../src/domain/season/lmsPresets'

/**
 * The Last Man Standing setup exists twice: `validateLmsSetup` decides what is
 * legal in TypeScript, and contract 72's check constraints decide it in the
 * database. Both must draw the same line.
 *
 * The line that matters most is the public one. `publicLmsSetup()` pins a
 * public competition to Classic — no lives, no saves, draws eliminate — because
 * a public game has no creator to choose its rules. "Public with two lives" is
 * not a variant; it is an unreviewed rule reaching real entrants, and the only
 * thing standing between that and the database is a constraint nobody reads
 * unless a test names it.
 *
 * Text-based over the committed migration; behaviour is proven against a real
 * database in `124_lms_persistence.sql`.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

const setupTable =
  /create table public\.season_lms_setups \(([\s\S]*?)\n\);/.exec(allSql)?.[1] ?? ''

describe('the setup table exists', () => {
  it('is found, so the assertions below are not vacuous', () => {
    expect(setupTable, 'season_lms_setups definition not found').not.toBe('')
  })
})

describe('the bounds match the TypeScript authority', () => {
  it('caps lives at the same number', () => {
    expect(LMS_MAX_LIVES).toBe(3)
    expect(setupTable).toMatch(new RegExp(`lives between 0 and ${LMS_MAX_LIVES}\\b`))
    expect(validateLmsSetup({ ...lmsPreset('classic'), lives: LMS_MAX_LIVES + 1 })).toEqual({
      valid: false,
      reason: 'lives_out_of_range',
    })
  })

  it('caps saves at the same number', () => {
    expect(LMS_MAX_SAVES).toBe(2)
    expect(setupTable).toMatch(new RegExp(`saves between 0 and ${LMS_MAX_SAVES}\\b`))
    expect(validateLmsSetup({ ...lmsPreset('classic'), saves: LMS_MAX_SAVES + 1 })).toEqual({
      valid: false,
      reason: 'saves_out_of_range',
    })
  })

  it('permits exactly the same draws rules', () => {
    expect(setupTable).toContain("draws_rule in ('eliminate', 'survive')")
  })

  it('permits exactly the same wipeout outcomes', () => {
    expect(setupTable).toContain("endgame_on_wipeout in ('play_on', 'shared_win', 'reset')")
  })
})

describe('a public competition is Classic, and only Classic', () => {
  it('is Classic in TypeScript', () => {
    const classic = lmsPreset('classic')
    const publicSetup = publicLmsSetup()

    expect(publicSetup.lives).toBe(classic.lives)
    expect(publicSetup.saves).toBe(classic.saves)
    expect(publicSetup.drawsRule).toBe(classic.drawsRule)
    expect(publicSetup.endgame).toEqual({ scope: 'public' })
    // The values the constraint has to enforce.
    expect(classic.lives).toBe(0)
    expect(classic.saves).toBe(0)
  })

  it('is refused by the database when it is not', () => {
    expect(setupTable).toContain('season_lms_setups_public_is_classic')
    expect(setupTable).toMatch(
      /endgame_scope <> 'public'\s*\n?\s*or \(lives = 0 and saves = 0 and draws_rule = 'eliminate'\)/,
    )
  })
})

describe('the endgame shape cannot be half-recorded', () => {
  it('requires a wipeout outcome exactly when the scope is private', () => {
    // Private with no wipeout rule is undecidable at settlement; public with
    // one is a rule nobody chose.
    expect(setupTable).toContain(
      "(endgame_scope = 'private') = (endgame_on_wipeout is not null)",
    )
    expect(validateLmsSetup({ ...lmsPreset('classic'), endgame: { scope: 'public' } })).toEqual({
      valid: true,
    })
  })
})

describe('entrant state cannot exceed what the setup granted', () => {
  it('is checked against the setup rather than a constant', () => {
    // resolve_lms_pick spends what it is handed, so an entrant carrying more
    // lives than the setup granted survives extra defeats and nothing looks
    // wrong afterwards.
    expect(allSql).toContain('assert_lms_entrant_allowance')
    expect(allSql).toMatch(/new\.lives_remaining > v_lives/)
    expect(allSql).toMatch(/new\.saves_remaining > v_saves/)
    expect(allSql).toMatch(/from public\.season_lms_setups setup/)
  })

  it('refuses entrant state with no setup at all', () => {
    // Without this the comparison would be against null and pass silently.
    expect(allSql).toContain('has no Last Man Standing setup')
  })
})

describe('the Last Man Standing surface stays server-side', () => {
  it('revokes both tables from every browser role', () => {
    for (const table of ['season_lms_setups', 'season_lms_entrant_state']) {
      expect(allSql).toMatch(
        new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`),
      )
      expect(allSql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      )
    }
  })

  it('does not duplicate the pick store that already exists', () => {
    // bonus_lms_selections already holds picks, including the used-team rule.
    expect(allSql).toContain('unique (competition_id, user_id, team_id)')
    expect(setupTable).not.toMatch(/team_id/)
  })
})
