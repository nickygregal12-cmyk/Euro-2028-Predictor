import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  contractSixtyFourPrecondition,
  emptyTransition,
  populatedTransition,
  rollbackRestoresPreMigrationState,
} from './stageC1AuditScopeScript'

/**
 * The contract 64 → 65 transition, rehearsed against a database that holds audit
 * rows.
 *
 * Stage C1 gives `bonus_competition_audit` a derived `tournament_id` and backfills
 * it from the row's bonus competition. That table is the one backfill target
 * carrying a row-level BEFORE UPDATE OR DELETE immutability trigger, and a
 * row-level trigger never fires when a statement matches zero rows. Every check
 * in the pipeline rebuilt from zero into an empty audit table, so the statement
 * that mattered was executed against nothing, every time. Hosted development had
 * nine audit rows; there the same statement raised 42501 and the whole migration
 * rolled back.
 *
 * Rebuild coverage cannot find this class of defect — the emptiness is what makes
 * it pass. So this suite crosses the transition on purpose, with rows present,
 * and asserts both halves of the requirement: the derived scope arrives, and
 * nothing about the recorded history moves.
 *
 * The job resets to canonical contract 64 before this file runs. Each case is one
 * transaction that is rolled back, so the database is left where it started.
 */

const databaseEnabled = process.env.DATABASE_PARITY === '1'
const databaseDescribe = databaseEnabled ? describe : describe.skip
const databaseContainer =
  process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_euro-2028-predictor-local'

const CONTRACT_64_MIGRATION = '20260730180000'
const STAGE_C1_MIGRATION = '20260730235602_stage_c1_competition_season_foundation.sql'

const stageC1 = readFileSync(
  resolve(process.cwd(), 'supabase/migrations', STAGE_C1_MIGRATION),
  'utf8',
)

/**
 * `ON_ERROR_STOP` is set by the scripts rather than on the command line, because
 * the rollback case has to lift it across one deliberately failing statement.
 */
function runScript(script: string): Record<string, unknown> {
  const output = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      databaseContainer,
      'psql',
      '-X',
      '-q',
      '-t',
      '-A',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    { encoding: 'utf8', input: script, stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()

  const payload = output.split('\n').filter(Boolean).at(-1)
  expect(payload, 'psql produced no probe payload').toBeTruthy()

  return JSON.parse(payload!) as Record<string, unknown>
}

databaseDescribe('Stage C1 audit scope backfill across contract 64 → 65', () => {
  beforeAll(() => {
    // Without this, every case below would run against a database that already
    // has the column and pass while proving nothing about the transition.
    const state = runScript(contractSixtyFourPrecondition())

    expect(state.latest_migration).toBe(CONTRACT_64_MIGRATION)
    expect(state.audit_scope_column_exists).toBe(false)
    expect(state.immutability_trigger_state).toBe('O')
  })

  it('applies to a populated audit table without touching recorded history', () => {
    const probe = runScript(populatedTransition(stageC1))

    expect(probe.row_count_before).toBe(9)
    expect(probe.row_count_after).toBe(9)
    expect(probe.rows_missing_after).toBe(0)
    expect(probe.rows_added_after).toBe(0)
    // Every column except the new tournament_id, compared against the values
    // captured before the migration ran.
    expect(probe.rows_with_changed_history).toBe(0)
  })

  it('scopes every historical audit row to its competition parent', () => {
    const probe = runScript(populatedTransition(stageC1))

    expect(probe.rows_without_scope).toBe(0)
    expect(probe.rows_scoped_to_parent).toBe(9)
    expect(probe.audit_scope_not_null).toBe(true)
    expect(probe.season_scope_fkey_validated).toBe(true)
  })

  it('restores audit immutability before the migration can commit', () => {
    const probe = runScript(populatedTransition(stageC1))

    expect(probe.immutability_trigger_state).toBe('O')
    expect(probe.update_sqlstate).toBe('42501')
    expect(probe.delete_sqlstate).toBe('42501')
    // A broadened suspension would leave something else behind even if the audit
    // trigger itself came back.
    expect(probe.disabled_triggers_anywhere).toEqual([])
  })

  it('still rebuilds when the audit table is empty', () => {
    const probe = runScript(emptyTransition(stageC1))

    expect(probe.row_count_before).toBe(0)
    expect(probe.row_count_after).toBe(0)
    expect(probe.rows_without_scope).toBe(0)
    expect(probe.audit_scope_not_null).toBe(true)
    expect(probe.season_scope_fkey_validated).toBe(true)
    expect(probe.immutability_trigger_state).toBe('O')
    expect(probe.disabled_triggers_anywhere).toEqual([])
  })

  it('leaves the trigger and schema untouched when a later statement fails', () => {
    const probe = runScript(rollbackRestoresPreMigrationState(stageC1))

    expect(probe.audit_scope_column_exists).toBe(false)
    expect(probe.immutability_trigger_state).toBe('O')
    expect(probe.row_count_after).toBe(9)
    expect(probe.rows_with_changed_history).toBe(0)
    expect(probe.update_sqlstate).toBe('42501')
    expect(probe.delete_sqlstate).toBe('42501')
  })
})
