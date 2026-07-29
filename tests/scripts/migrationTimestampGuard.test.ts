import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve(
  process.cwd(),
  'scripts/check-migration-timestamps.mjs',
)
const temporaryRoots: string[] = []

function git(cwd: string, args: string[]) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

function writeMigration(repository: string, filename: string) {
  const path = resolve(repository, 'supabase/migrations', filename)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '-- test migration\n', 'utf8')
}

function commitAll(repository: string, message: string) {
  git(repository, ['add', '.'])
  git(repository, ['commit', '-m', message])
}

function createFixtureRepository() {
  const root = mkdtempSync(resolve(tmpdir(), 'euro28-migration-guard-'))
  const origin = resolve(root, 'origin.git')
  const repository = resolve(root, 'repository')
  temporaryRoots.push(root)

  mkdirSync(repository, { recursive: true })
  git(root, ['init', '--bare', origin])
  git(repository, ['init', '--initial-branch=main'])
  git(repository, ['config', 'user.email', 'migration-guard@example.test'])
  git(repository, ['config', 'user.name', 'Migration Guard Test'])

  writeMigration(repository, '20260729110000_main_baseline.sql')
  commitAll(repository, 'Add main migration')
  git(repository, ['remote', 'add', 'origin', origin])
  git(repository, ['push', '-u', 'origin', 'main'])
  git(repository, ['switch', '-c', 'feature'])

  return repository
}

function runGuard(repository: string) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MIGRATION_GUARD_REPO_ROOT: repository,
    },
    encoding: 'utf8',
  })
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('migration timestamp guard', () => {
  it('passes cleanly when a pull request adds no migrations', () => {
    const repository = createFixtureRepository()
    const result = runGuard(repository)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('no migrations added')
    expect(result.stdout).toContain('20260729110000')
  })

  it('fails with the offending filename, timestamp and main highest on collision', () => {
    const repository = createFixtureRepository()
    writeMigration(repository, '20260729110000_colliding_change.sql')
    commitAll(repository, 'Add colliding migration')

    const result = runGuard(repository)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('20260729110000_colliding_change.sql')
    expect(result.stderr).toContain('timestamp 20260729110000')
    expect(result.stderr).toContain('origin/main highest 20260729110000')
  })

  it('passes multiple strictly ordered migrations above main', () => {
    const repository = createFixtureRepository()
    writeMigration(repository, '20260729122100_first_valid_change.sql')
    writeMigration(repository, '20260729122200_second_valid_change.sql')
    commitAll(repository, 'Add ordered migrations')

    const result = runGuard(repository)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('2 added migration(s)')
    expect(result.stdout).toContain('strictly ordered')
    expect(result.stdout).toContain('20260729110000')
  })

  it('fails when added migrations do not have strictly increasing timestamps', () => {
    const repository = createFixtureRepository()
    writeMigration(repository, '20260729122100_first_change.sql')
    writeMigration(repository, '20260729122100_second_change.sql')
    commitAll(repository, 'Add duplicate migration timestamps')

    const result = runGuard(repository)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('20260729122100_second_change.sql')
    expect(result.stderr).toContain('strictly ordered')
    expect(result.stderr).toContain('origin/main highest is 20260729110000')
  })
})
