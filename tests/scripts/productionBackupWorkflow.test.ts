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

  it('verifies restored migration history at the contract-38 head', () => {
    expect(workflow).toContain("EXPECTED_MIGRATION_COUNT: '38'")
    expect(workflow).toContain(
      "EXPECTED_LATEST_MIGRATION_VERSION: '20260727080159'",
    )
    expect(workflow).toContain(
      'EXPECTED_LATEST_MIGRATION_NAME: admin_result_revision_timestamp',
    )
    expect(rehearsalVerification).toContain(
      'supabase_migrations.schema_migrations',
    )
    expect(rehearsalVerification).toContain('expected_migration_count')
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
})
