import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(
  process.cwd(),
  'scripts/database-rollout/create-production-backup.sh',
)
const script = readFileSync(scriptPath, 'utf8')

describe('production backup script', () => {
  it('has valid Bash syntax', () => {
    expect(() => execFileSync('bash', ['-n', scriptPath])).not.toThrow()
  })

  it('is pinned to the production project and requires explicit acknowledgement', () => {
    expect(script).toContain('vkfnsqdyhvtwyqkisxhk')
    expect(script).toContain('CONFIRM_PRODUCTION_PROJECT_REF')
    expect(script).toContain('PRODUCTION_DB_URL')
  })

  it('refuses repository-local, symlinked output and a dirty source tree', () => {
    expect(script).toContain('BACKUP_ROOT must be outside the repository')
    expect(script).toContain('BACKUP_ROOT must not be a symbolic link')
    expect(script).toContain('[[ ! -L "${BACKUP_ROOT}" ]]')
    expect(script).toContain('Repository working tree must be clean')
  })

  it('captures roles, schema, data, managed-schema drift and checksums', () => {
    expect(script).toContain('--role-only')
    expect(script).toContain('--data-only')
    expect(script).toContain('--use-copy')
    expect(script).toContain('--schema auth,storage')
    expect(script).toContain('managed-schema-customizations.sql')
    expect(script).toContain('SHA256SUMS')
  })

  it('does not link, migrate, reset or seed a project', () => {
    expect(script).not.toMatch(/supabase\s+link/)
    expect(script).not.toMatch(/supabase\s+db\s+push/)
    expect(script).not.toMatch(/supabase\s+db\s+reset/)
    expect(script).not.toContain('--include-seed')
  })

  it('marks plaintext output as sensitive and not yet qualifying evidence', () => {
    expect(script).toContain('plaintext_contains_sensitive_auth_data')
    expect(script).toContain('qualifying_recovery_evidence')
    expect(script).toContain('Encrypt it')
    expect(script).toContain('restore it to a disposable')
  })
})
