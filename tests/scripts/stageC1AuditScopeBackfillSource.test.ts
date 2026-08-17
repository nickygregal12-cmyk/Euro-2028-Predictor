import { execFileSync, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * The shape of the Stage C1 audit-scope backfill, read out of the migration.
 *
 * `bonus_competition_audit` is append-only: a row-level BEFORE UPDATE OR DELETE
 * trigger raises 42501 on any mutation. Stage C1 has to write one new derived
 * column onto the historical rows, which is the single legitimate exception —
 * adding competition-season scope is schema evolution, not a correction to the
 * recorded action, detail, actor or timestamp.
 *
 * The transition rehearsal proves the migration reaches the right end state. It
 * cannot prove *how*: `disable trigger all` around the same backfill, or a
 * permanent bypass inside the trigger function, would reach an identical end
 * state and pass every one of those assertions. That is what this file is for.
 * It fixes the mechanism — one named trigger, suspended around one statement
 * that writes one column — so a broader suspension has to fail here.
 *
 * Text-based over the committed migrations, so it needs no database.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')
const STAGE_C1 = '20260730235602_stage_c1_competition_season_foundation.sql'

/**
 * Line comments are stripped before matching. These migrations document
 * themselves by quoting the DDL they describe, and the commentary above the
 * backfill names `disable trigger` in prose — documentation must not be able to
 * satisfy, or fail, a source assertion.
 */
function withoutComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

function normalise(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

function migrationSource(file: string): string {
  return withoutComments(readFileSync(resolve(migrationsDirectory, file), 'utf8'))
}

const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()

const stageC1 = migrationSource(STAGE_C1)

const DISABLE = 'alter table public.bonus_competition_audit disable trigger block_bonus_audit_mutation;'
const ENABLE = 'alter table public.bonus_competition_audit enable trigger block_bonus_audit_mutation;'
const BACKFILL =
  'update public.bonus_competition_audit x set tournament_id = c.tournament_id ' +
  'from public.bonus_competitions c where c.id = x.competition_id and x.tournament_id is null;'

const normalised = normalise(stageC1)
const stageC1OpsRoot = resolve(repositoryRoot, 'supabase/ops/stage-c1')
const stageC1ScriptRoot = resolve(repositoryRoot, 'scripts/ops')
const canonicalAuditDigest = readFileSync(
  resolve(stageC1OpsRoot, 'stage-c1-audit-digest.sql'),
  'utf8',
)
const hostedPreflight = readFileSync(
  resolve(stageC1OpsRoot, 'stage-c1-hosted-preflight.sql'),
  'utf8',
)
const hostedPostflight = readFileSync(
  resolve(stageC1OpsRoot, 'stage-c1-hosted-postflight.sql'),
  'utf8',
)
const verifiedBackup = readFileSync(
  resolve(stageC1ScriptRoot, 'create-verified-supabase-backup.mjs'),
  'utf8',
)
const evidenceLibrary = readFileSync(
  resolve(stageC1ScriptRoot, 'stage-c1-evidence-lib.mjs'),
  'utf8',
)

describe('Stage C1 audit scope backfill source', () => {
  it('suspends the audit trigger by name before the backfill', () => {
    const disableAt = normalised.indexOf(DISABLE)
    const backfillAt = normalised.indexOf(BACKFILL)

    expect(disableAt, 'the named trigger suspension is missing').toBeGreaterThan(-1)
    expect(backfillAt, 'the audit scope backfill is missing').toBeGreaterThan(-1)
    expect(disableAt).toBeLessThan(backfillAt)
  })

  it('re-enables the audit trigger immediately after the backfill', () => {
    // Exactly one statement may sit inside the suspension window. Anything else
    // moving in — another table's backfill, a second update, a stray delete —
    // changes this slice and fails here.
    const between = normalised.slice(
      normalised.indexOf(DISABLE) + DISABLE.length,
      normalised.indexOf(ENABLE),
    )

    expect(normalise(between)).toBe(BACKFILL)
  })

  it('writes only tournament_id, and only where it is still unset', () => {
    // One update against the audit table across the whole migration set, and its
    // assignment list is a single column. `recorded_at`, `actor_id`, `action`,
    // `detail` and `competition_id` are not writable by any of them.
    const updates = migrationFiles.flatMap((file) =>
      [
        ...normalise(migrationSource(file)).matchAll(
          /update public\.bonus_competition_audit\b[^;]*;/g,
        ),
      ].map((match) => at(match, 0)),
    )

    expect(updates).toHaveLength(1)

    const assignments = at(updates, 0).slice(
      at(updates, 0).indexOf(' set ') + ' set '.length,
      at(updates, 0).indexOf(' from '),
    )

    expect(assignments).toBe('tournament_id = c.tournament_id')
    expect(updates[0]).toContain('and x.tournament_id is null;')
  })

  it('derives scope only through the competition parent', () => {
    const backfill = normalised.slice(
      normalised.indexOf(BACKFILL),
      normalised.indexOf(BACKFILL) + BACKFILL.length,
    )

    expect(backfill).toContain('from public.bonus_competitions c')
    expect(backfill).toContain('where c.id = x.competition_id')
  })

  it('suspends nothing beyond that one trigger, anywhere in the migration set', () => {
    for (const file of migrationFiles) {
      const source = normalise(migrationSource(file))
      const suspensions = [...source.matchAll(/disable trigger ([a-z_"* ]+?);/g)].map(
        (match) => at(match, 1).trim(),
      )

      if (file === STAGE_C1) {
        expect(suspensions, `${file} trigger suspensions`).toEqual([
          'block_bonus_audit_mutation',
        ])
        continue
      }

      expect(suspensions, `${file} must not suspend triggers`).toEqual([])
    }
  })

  it('uses no blanket suspension, replication-role switch or RLS relaxation', () => {
    for (const file of migrationFiles) {
      const source = normalise(migrationSource(file))

      expect(source, `${file} disable trigger all`).not.toContain('disable trigger all')
      expect(source, `${file} disable trigger user`).not.toContain('disable trigger user')
      expect(source, `${file} session_replication_role`).not.toContain(
        'session_replication_role',
      )
      expect(source, `${file} disable row level security`).not.toContain(
        'disable row level security',
      )
    }
  })

  it('adds no permanent bypass of audit immutability', () => {
    // The guard function keeps the definition it was created with, and nothing
    // drops or replaces the trigger to get around it.
    expect(stageC1).not.toContain('function predictor_internal.block_bonus_audit_mutation')
    expect(normalised).not.toContain('drop trigger block_bonus_audit_mutation')
    expect(normalised).not.toContain('drop trigger if exists block_bonus_audit_mutation')

    // No settable escape hatch — a GUC read inside the guard would let any
    // session with `set` turn immutability off.
    const guard = migrationSource('20260728150000_bonus_games_platform.sql')
    const body = guard.slice(
      guard.indexOf('function predictor_internal.block_bonus_audit_mutation'),
    )
    expect(body).toContain("raise exception 'Bonus competition audit entries are immutable'")
    expect(body.slice(0, body.indexOf('create trigger'))).not.toContain('current_setting')
  })

  it('grants no role direct mutation access to the audit table', () => {
    // The suspension is transaction-local and the migration runs as the table
    // owner. Browser roles and the service role must still hold nothing.
    const grants = migrationFiles.flatMap((file) => {
      const source = normalise(migrationSource(file))
      return [
        ...source.matchAll(
          /grant ([a-z, ]+?) on (?:table )?public\.bonus_competition_audit to ([a-z_, ]+);/g,
        ),
      ].map((match) => `${file}: ${match[1]} -> ${match[2]}`)
    })

    expect(grants).toEqual([])
  })
})

describe('Stage C1 hosted operational evidence', () => {
  it('defines the canonical historical digest without the new scope field', () => {
    for (const field of ['id', 'competition_id', 'action', 'detail', 'actor_id']) {
      expect(canonicalAuditDigest).toContain(`'${field}', ${field}`)
    }
    expect(canonicalAuditDigest).toContain("recorded_at at time zone 'UTC'")
    expect(canonicalAuditDigest).toContain('HH24:MI:SS.US')
    expect(canonicalAuditDigest).toContain("'[]'::jsonb")
    expect(canonicalAuditDigest).toContain('order by id')
    expect(canonicalAuditDigest).toContain("'sha256'")
    expect(canonicalAuditDigest).not.toContain("'tournament_id', tournament_id")
  })

  it('pins preflight and postflight to their exact hosted contracts', () => {
    expect(hostedPreflight).toContain('migration_count <> 64')
    expect(hostedPreflight).toContain("latest_version is distinct from '20260730180000'")
    expect(hostedPreflight).toContain("to_regclass('public.competitions') is not null")
    expect(hostedPreflight).toContain("t.tgname = 'block_bonus_audit_mutation'")
    expect(hostedPreflight).toContain('stage_c1_preflight')

    expect(hostedPostflight).toContain('migration_count <> 65')
    expect(hostedPostflight).toContain("latest_version is distinct from '20260730235602'")
    expect(hostedPostflight).toContain('Expected exactly 33 direct non-null UUID tournament_id columns')
    expect(hostedPostflight).toContain('Expected 68 reviewed public-table triggers')
    expect(hostedPostflight).toContain('Expected 18 ENABLE ALWAYS season-scope triggers')
    expect(hostedPostflight).toContain("when sqlstate '42501' then null")
    expect(hostedPostflight).toContain('stage_c1_postflight')
  })

  it('refuses production, drifted main, an unpinned CLI and migration drift', () => {
    expect(evidenceLibrary).toContain("PRODUCTION_PROJECT_REF = 'vkfnsqdyhvtwyqkisxhk'")
    expect(evidenceLibrary).toContain('Evidence must run from exact origin/main')
    expect(evidenceLibrary).toContain("EXPECTED_SUPABASE_VERSION = '2.84.2'")
    expect(evidenceLibrary).toContain(
      '010eff888e9a5884d40467802e13a2997ddaa8827e9cf44d659154972e13b656',
    )
    expect(evidenceLibrary).toContain('Repository working tree must be clean')
  })

  it('provides executable evidence runners and rejects preservation drift', () => {
    for (const script of [
      'run-stage-c1-hosted-preflight.mjs',
      'run-stage-c1-hosted-postflight.mjs',
    ]) {
      expect(() =>
        execFileSync(process.execPath, [resolve(stageC1ScriptRoot, script), '--help']),
      ).not.toThrow()
    }

    const libraryUrl = pathToFileURL(
      resolve(stageC1ScriptRoot, 'stage-c1-evidence-lib.mjs'),
    ).href
    const evidence = {
      audit: { digest: 'abc', row_count: 1 },
      preservation_counts: { entries: 1 },
      euro_2028: [{ id: 'one' }],
      auth_foreign_keys: [{ table: 'entries' }],
      ownership_policies: [{ table: 'entries' }],
      browser_grants: [{ table: 'entries' }],
      rls_state: [{ table: 'entries', enabled: true }],
      function_security: [{ signature: 'f()', security_definer: false }],
      trigger_bindings: [{ table: 'entries', trigger: 't', enabled: 'O' }],
    }
    const artifact = { repository_commit: 'head', evidence }
    const program = `
      import { assertEquivalentBeforeState } from ${JSON.stringify(libraryUrl)};
      const expected = ${JSON.stringify(artifact)};
      assertEquivalentBeforeState(expected, expected);
      const changed = structuredClone(expected);
      changed.evidence.preservation_counts.entries = 2;
      try {
        assertEquivalentBeforeState(expected, changed);
        process.exit(2);
      } catch (error) {
        if (!error.message.includes('Preservation row counts')) process.exit(3);
      }
    `
    expect(() =>
      execFileSync(process.execPath, ['--input-type=module', '--eval', program]),
    ).not.toThrow()
  })

  it('fails the verified backup closed without the owner age recipient', () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve(stageC1ScriptRoot, 'create-verified-supabase-backup.mjs'),
        '--project-ref',
        'iouzoutneyjpugbbtdem',
        '--preflight',
        '/tmp/preflight.json',
        '--backup-root',
        '/tmp/backups',
      ],
      { encoding: 'utf8', env: { ...process.env, BACKUP_AGE_PUBLIC_KEY: '' } },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('BACKUP_AGE_PUBLIC_KEY')
  })

  it('restores every required logical path before encrypting and shredding', () => {
    expect(verifiedBackup).toContain("'--role-only'")
    expect(verifiedBackup).toContain("'--data-only', '--use-copy'")
    expect(verifiedBackup).toContain("'--schema', 'supabase_migrations'")
    expect(verifiedBackup).toContain('auth.users')
    expect(verifiedBackup).toContain('public.profiles')
    // Database container only: the rehearsal is a SQL-level proof and the
    // full stack's auxiliary services repeatedly failed CI health checks.
    expect(verifiedBackup).toContain("run(supabase, ['db', 'start'])")
    expect(verifiedBackup).toContain('assertEquivalentBeforeState(source')
    expect(verifiedBackup.indexOf("run(age, ['-r'")).toBeGreaterThan(
      verifiedBackup.indexOf('assertEquivalentBeforeState(source'),
    )
    expect(verifiedBackup.indexOf('secureRemove(bundle')).toBeGreaterThan(
      verifiedBackup.indexOf("run(age, ['-r'"),
    )
    expect(verifiedBackup).not.toMatch(/db['"],\s*['"]push/)
    expect(verifiedBackup).not.toContain('migration repair')
  })
})
