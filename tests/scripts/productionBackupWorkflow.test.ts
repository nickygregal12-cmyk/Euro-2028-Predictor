import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/production-backup.yml'),
  'utf8',
)
const rehearsalVerification = readFileSync(
  resolve(
    repositoryRoot,
    'scripts/database-rollout/restore-rehearsal-verification.sql',
  ),
  'utf8',
)

describe('production backup workflow', () => {
  it('is manually triggered only', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/^\s+push:/m)
    expect(workflow).not.toMatch(/^\s+pull_request:/m)
    expect(workflow).not.toMatch(/^\s+schedule:/m)
  })

  it('fails closed when either required secret is missing', () => {
    expect(workflow).toContain('secrets.SUPABASE_PROD_DB_URL')
    expect(workflow).toContain('secrets.BACKUP_AGE_PUBLIC_KEY')
    expect(workflow).toContain('SUPABASE_PROD_DB_URL is not set')
    expect(workflow).toContain('BACKUP_AGE_PUBLIC_KEY is not set')
  })

  it('is pinned to the production project and stays read-only', () => {
    expect(workflow).toContain('EXPECTED_PROJECT_REF: vkfnsqdyhvtwyqkisxhk')
    expect(workflow).not.toMatch(/supabase\s+db\s+push/)
    expect(workflow).not.toMatch(/supabase\s+db\s+reset/)
    expect(workflow).not.toMatch(/supabase\s+migration\s+repair/)
    expect(workflow).not.toMatch(/supabase\s+link/)
  })

  it('never echoes the production connection string', () => {
    expect(workflow).not.toMatch(/echo[^\n]*\$\{?SUPABASE_PROD_DB_URL/)
    expect(workflow).not.toMatch(/printf[^\n]*\$\{?SUPABASE_PROD_DB_URL/)
  })

  it('rehearses a disposable local restore before encryption', () => {
    expect(workflow).toContain('supabase start')
    expect(workflow).toContain('supabase stop --no-backup')
    expect(workflow).toContain('version: 2.109.1')
    expect(workflow).toContain(
      'auth.custom_oauth_providers.custom_claims_allowlist',
    )
    expect(workflow).toContain('restore-rehearsal-verification.sql')
    expect(workflow).toContain(
      'truncate table storage.objects, storage.buckets cascade;',
    )
    expect(workflow).not.toMatch(/delete from storage\.(objects|buckets)/)
    expect(workflow.indexOf('supabase start')).toBeLessThan(
      workflow.indexOf('age -r'),
    )
    expect(workflow.lastIndexOf('restore-rehearsal-verification.sql')).toBeLessThan(
      workflow.indexOf('age -r'),
    )
  })

  it('derives restored migration-history expectations from committed authority', () => {
    expect(workflow).toContain(
      'node scripts/deployment-contract-expectations.mjs >> "$GITHUB_ENV"',
    )
    expect(rehearsalVerification).toContain(
      'supabase_migrations.schema_migrations',
    )
    expect(rehearsalVerification).toContain('expected_migration_count')
  })

  it('never pins the migration-history expectations as workflow literals', () => {
    // These were pinned to contract 60 while the deployment contract declared
    // 63, so the restore rehearsal asserted a superseded migration history.
    // A job- or step-level env key also overrides $GITHUB_ENV, which would
    // reintroduce the same silent drift, so absence is asserted rather than
    // a corrected value.
    for (const name of [
      'EXPECTED_MIGRATION_COUNT',
      'EXPECTED_LATEST_MIGRATION_VERSION',
      'EXPECTED_LATEST_MIGRATION_NAME',
    ]) {
      expect(workflow).not.toMatch(new RegExp(`^\\s*${name}:`, 'm'))
      expect(workflow).toContain(`\${${name}}`)
    }
  })

  it('derives the expectations before the restore rehearsal consumes them', () => {
    expect(
      workflow.indexOf('node scripts/deployment-contract-expectations.mjs'),
    ).toBeLessThan(workflow.indexOf('restore-rehearsal-verification.sql'))
  })

  it('prints counts only from the restored copy', () => {
    expect(workflow).toContain(
      'psql "${LOCAL_DB_URL}" -X -q -v ON_ERROR_STOP=1 -A -t',
    )
    expect(rehearsalVerification).toContain('counts only')
    expect(rehearsalVerification).not.toMatch(/select\s+email/i)
    expect(rehearsalVerification).not.toMatch(/display_name/i)
    expect(rehearsalVerification).not.toMatch(/raw_user_meta_data/i)
  })

  it('requires the auth-schema data path from the existing backup script', () => {
    expect(workflow).toContain('auth"?\\."?users')
    expect(workflow).toContain('public"?\\."?profiles')
    expect(workflow).toContain('--use-copy')
    expect(workflow).toContain('--role-only')
  })

  it('encrypts before upload and shreds the plaintext dump', () => {
    expect(workflow).toContain('age -r')
    expect(workflow).toContain('.backup.tar.gz.age')
    expect(workflow).toContain('shred -u')
    expect(workflow.indexOf('shred -u')).toBeLessThan(
      workflow.indexOf('actions/upload-artifact'),
    )
  })

  it('uploads only the encrypted artifact with 7-day retention', () => {
    expect(workflow).toContain('retention-days: 7')
    expect(workflow).toContain('if-no-files-found: error')
    expect(workflow).toMatch(/path: .*\.backup\.tar\.gz\.age/)
    expect(workflow).toContain("! -name '*.backup.tar.gz.age'")
    expect(workflow).toContain('Refuse any non-encrypted upload candidate')
  })

  it('refuses non-encrypted candidates before the upload, not after it', () => {
    // The assertion above proves the refusal step exists; this one proves it
    // still runs in time to refuse anything. `shred` is already pinned ahead of
    // the upload, and this step was not — move it below `actions/upload-artifact`
    // and every other assertion in this file stays green while the check reports
    // a plaintext upload that has already happened.
    expect(workflow.indexOf('Refuse any non-encrypted upload candidate')).toBeLessThan(
      workflow.indexOf('actions/upload-artifact'),
    )
  })

  it('does not make the encryption rule conditional on repository visibility', () => {
    // The workflow header and the runbook both used to justify encrypting the
    // artifact "because this repository is public". That is a true fact wired
    // into a load-bearing position: it reads as a rule that lapses when the
    // repository turns private, which is exactly when someone would be looking
    // for reasons to simplify the job. The reason is that a workflow artifact
    // is readable by everyone with repository read access, which is not the
    // same set as "the public" and not the same set as "people trusted with a
    // production dump".
    //
    // Asserted as a presence, not an absence. The first version of this test
    // also forbade the string "because this repository is public" — and failed
    // immediately, because the header quotes that phrase in order to explain
    // why it is wrong. A string check cannot tell an assertion from a citation
    // of the same words, so the negative form was dropped rather than worked
    // around.
    //
    // The presence check is the one that bites anyway: rewriting the header to
    // make encryption contingent on visibility means deleting this sentence,
    // and that fails here. What is on the other side of that edit is
    // `auth.users` in plaintext on a downloadable artifact.
    expect(workflow).toMatch(/does NOT depend on the repository's visibility/)
  })
})
