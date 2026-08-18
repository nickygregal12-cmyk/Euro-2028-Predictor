import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CRITICAL_COUNT_KEYS,
  EXPECTED_CRITICAL_COUNT_DELTAS,
  EXPECTED_MIGRATIONS,
  SOURCE_CONTRACT,
  TARGET_CONTRACT,
  assertCriticalCountsAfterBatchA,
  assertCriticalCountsUnchanged,
  assertDisposableLocalDatabase,
  assertDomesticSeasonBoundary,
  assertSourceInventory,
} from '../../scripts/database-rollout/rehearse-production-batch-a.mjs'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/production-batch-a-rehearsal.yml'),
  'utf8',
)
const inventory = readFileSync(
  resolve(repositoryRoot, 'scripts/database-rollout/production-backup-inventory.sql'),
  'utf8',
)
const driver = readFileSync(
  resolve(repositoryRoot, 'scripts/database-rollout/rehearse-production-batch-a.mjs'),
  'utf8',
)

describe('Production Batch A rehearsal', () => {
  it('is manual-only and requires explicit Production confirmation', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s+push:/m)
    expect(workflow).not.toMatch(/^\s+pull_request:/m)
    expect(workflow).not.toMatch(/^\s+schedule:/m)
    expect(workflow).toContain('REHEARSE-PRODUCTION-BATCH-A')
    expect(workflow).toContain('EXPECTED_PROJECT_REF: vkfnsqdyhvtwyqkisxhk')
    expect(workflow).toContain('FORBIDDEN_DEVELOPMENT_REF: iouzoutneyjpugbbtdem')
  })

  it('uses hosted Production only as a read-only backup source', () => {
    expect(workflow).toContain('secrets.SUPABASE_PROD_DB_URL')
    expect(workflow).toContain('Capture fresh Production backup source (read-only)')
    expect(workflow).not.toMatch(
      /supabase\s+db\s+push\s+--db-url\s+"?\$\{SUPABASE_PROD_DB_URL\}/,
    )
    expect(workflow).not.toMatch(/supabase\s+migration\s+repair/)
    expect(workflow).not.toMatch(/supabase\s+link/)
  })

  it('pins the approved 63 to 67 Batch A boundary', () => {
    expect(SOURCE_CONTRACT).toBe(63)
    expect(TARGET_CONTRACT).toBe(67)
    expect(EXPECTED_MIGRATIONS).toEqual([
      '20260730180000_cup_winner_deletion_semantics.sql',
      '20260730235602_stage_c1_competition_season_foundation.sql',
      '20260803070000_c1b_game_catalogue_memberships.sql',
      '20260803180000_matchweek_lock_scope.sql',
    ])
    expect(workflow).toContain("[ \"${EXPECTED_MIGRATION_COUNT}\" = '63' ]")
    expect(driver).toContain("TARGET_VERSION = '20260803180000'")
  })

  it('refuses a migration target that is not the disposable local database', () => {
    expect(() =>
      assertDisposableLocalDatabase(
        'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      ),
    ).not.toThrow()
    for (const unsafe of [
      'postgresql://postgres:postgres@db.vkfnsqdyhvtwyqkisxhk.supabase.co:5432/postgres',
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
      'postgresql://postgres:postgres@localhost:54322/other',
    ]) {
      expect(() => assertDisposableLocalDatabase(unsafe)).toThrow()
    }
    expect(workflow).toContain(
      'LOCAL_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    )
  })

  it('carries every recorded critical Production count into the source inventory', () => {
    expect(CRITICAL_COUNT_KEYS).toEqual([
      'auth_users',
      'profiles',
      'tournaments',
      'teams',
      'matches',
      'entries',
      'match_predictions',
      'leagues',
      'league_members',
      'score_events',
      'entry_totals',
    ])
    for (const key of CRITICAL_COUNT_KEYS) {
      expect(inventory).toContain(`'${key}'`)
    }
  })

  it('keeps source counts exact and permits only the two intentional domestic season rows after Batch A', () => {
    const counts = Object.fromEntries(CRITICAL_COUNT_KEYS.map((key) => [key, 1]))
    expect(() => assertSourceInventory({ counts })).not.toThrow()
    expect(() => assertSourceInventory({ counts: { ...counts, teams: undefined } })).toThrow()
    expect(() => assertCriticalCountsUnchanged(counts, counts)).not.toThrow()
    expect(() =>
      assertCriticalCountsUnchanged(counts, { ...counts, matches: 2 }),
    ).toThrow()

    expect(EXPECTED_CRITICAL_COUNT_DELTAS).toEqual({ tournaments: 2 })
    const expectedPost = { ...counts, tournaments: 3 }
    expect(() => assertCriticalCountsAfterBatchA(counts, expectedPost)).not.toThrow()
    expect(() =>
      assertCriticalCountsAfterBatchA(counts, { ...expectedPost, matches: 2 }),
    ).toThrow()
    expect(() =>
      assertCriticalCountsAfterBatchA(counts, { ...expectedPost, tournaments: 4 }),
    ).toThrow()
  })

  it('pins the two intentional domestic season seed rows', () => {
    const expected = [
      {
        slug: 'premier-league',
        name: 'Premier League 2026/27',
        season_key: '2026-27',
        kind: 'league_season',
        display_timezone: 'Europe/London',
        status: 'draft',
      },
      {
        slug: 'scottish-premiership',
        name: 'Scottish Premiership 2026/27',
        season_key: '2026-27',
        kind: 'league_season',
        display_timezone: 'Europe/London',
        status: 'draft',
      },
    ]
    expect(() => assertDomesticSeasonBoundary(expected)).not.toThrow()
    expect(() => assertDomesticSeasonBoundary(expected.slice(0, 1))).toThrow()
  })

  it('proves the provider and scheduler boundary remains pre-provider', () => {
    expect(driver).toContain("extname = 'pg_net'")
    expect(driver).toContain('select public.process_due_entry_submissions();')
    expect(driver).toContain("job.schedule !== '* * * * *'")
    expect(driver).toContain("main_predictor: 'matchweek'")
    expect(driver).toContain("last_man_standing: 'matchweek'")
  })

  it('encrypts and uploads the fresh backup before surfacing rehearsal failure', () => {
    const encrypt = workflow.indexOf('age -r')
    const upload = workflow.search(/actions\/upload-artifact@[0-9a-f]{40}/)
    const failClosed = workflow.indexOf(
      'Fail closed if the requested Batch A forward rehearsal failed',
    )
    expect(encrypt).toBeGreaterThan(-1)
    expect(upload).toBeGreaterThan(encrypt)
    expect(failClosed).toBeGreaterThan(upload)
    expect(workflow).toContain('continue-on-error: true')
    expect(workflow).toContain('retention-days: 7')
    expect(workflow).toContain('shred -u')
  })
})
