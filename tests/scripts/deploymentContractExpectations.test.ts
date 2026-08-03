import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The suppression this import used to carry is gone: `tsconfig.test.json` now
// sets `allowJs`, so the script's own JSDoc types reach this suite instead of
// the import silently resolving to `any`.
import { deriveContractExpectations } from '../../scripts/deployment-contract-expectations.mjs'

const repositoryRoot = process.cwd()
const scriptPath = resolve(
  repositoryRoot,
  'scripts/deployment-contract-expectations.mjs',
)

function writeFixture(
  contract: { contractVersion: number; requiredMigrationCount: number },
  migrationNames: string[],
): string {
  const root = mkdtempSync(resolve(tmpdir(), 'contract-expectations-'))
  mkdirSync(resolve(root, 'config'), { recursive: true })
  mkdirSync(resolve(root, 'supabase/migrations'), { recursive: true })
  writeFileSync(
    resolve(root, 'config/deployment-contract.json'),
    JSON.stringify({ ...contract, requiredRpcSignatures: [] }),
  )
  for (const name of migrationNames) {
    writeFileSync(resolve(root, 'supabase/migrations', name), '-- fixture\n')
  }
  return root
}

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const deploymentContract = JSON.parse(
  readRepositoryFile('config/deployment-contract.json'),
) as { contractVersion: number; requiredMigrationCount: number }

const migrations = readdirSync(resolve(repositoryRoot, 'supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort()

function run(args: string[] = []): string {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

describe('deployment contract expectations', () => {
  it('emits GITHUB_ENV assignments the production guards can source', () => {
    // The workflows append this output straight to $GITHUB_ENV, so the
    // KEY=value shape is part of the contract, not an implementation detail.
    const lines = run().trim().split('\n')

    expect(lines).toEqual([
      `EXPECTED_CONTRACT=${deploymentContract.contractVersion}`,
      `EXPECTED_MIGRATION_COUNT=${deploymentContract.requiredMigrationCount}`,
      expect.stringMatching(/^EXPECTED_LATEST_MIGRATION_VERSION=\d{14}$/),
      expect.stringMatching(/^EXPECTED_LATEST_MIGRATION_NAME=[a-z0-9_]+$/),
    ])
  })

  it('derives the latest migration identity from the newest migration file', () => {
    const expectations = JSON.parse(run(['--json'])) as {
      latestMigrationVersion: string
      latestMigrationName: string
      migrationCount: number
    }

    expect(migrations.at(-1)).toBe(
      `${expectations.latestMigrationVersion}_${expectations.latestMigrationName}.sql`,
    )
    expect(expectations.migrationCount).toBe(migrations.length)
  })

  it('fails closed when the contract and the migration chain disagree', () => {
    // A wrong expectation asserted against production is worse than none, so
    // the script refuses to emit rather than guessing which source is right.
    const root = writeFixture(
      { contractVersion: 5, requiredMigrationCount: 5 },
      ['20260101000000_first.sql', '20260102000000_second.sql'],
    )

    expect(() => deriveContractExpectations({ root })).toThrow(
      /Repository has 2 migrations but the deployment contract requires 5/,
    )
  })

  it('refuses a migration filename it cannot derive an identity from', () => {
    const root = writeFixture(
      { contractVersion: 1, requiredMigrationCount: 1 },
      ['not-a-timestamped-migration.sql'],
    )

    expect(() => deriveContractExpectations({ root })).toThrow(
      /does not match <14-digit timestamp>/,
    )
  })

  it('derives the newest migration by version rather than by directory order', () => {
    const root = writeFixture(
      { contractVersion: 2, requiredMigrationCount: 2 },
      ['20260201000000_later.sql', '20260101000000_earlier.sql'],
    )

    expect(deriveContractExpectations({ root })).toMatchObject({
      contractVersion: 2,
      migrationCount: 2,
      latestMigrationVersion: '20260201000000',
      latestMigrationName: 'later',
    })
  })
})

describe('production guard workflows', () => {
  const backupWorkflow = readRepositoryFile(
    '.github/workflows/production-backup.yml',
  )
  const smokeWorkflow = readRepositoryFile(
    '.github/workflows/production-smoke.yml',
  )

  it('never hardcodes a contract version in a production guard', () => {
    // Regression guard: both files carried contract-60 pins while the
    // deployment contract declared 63.
    for (const workflow of [backupWorkflow, smokeWorkflow]) {
      expect(workflow).not.toMatch(/^\s*EXPECTED_CONTRACT:\s*'?\d+'?\s*$/m)
      expect(workflow).not.toMatch(
        /^\s*EXPECTED_MIGRATION_COUNT:\s*'?\d+'?\s*$/m,
      )
    }
  })

  it('resolves the production smoke contract from the deployment contract by default', () => {
    expect(smokeWorkflow).toContain(
      "require('./config/deployment-contract.json').contractVersion",
    )
    expect(smokeWorkflow).toContain('inputs.expected_contract')
    // The operator override exists for verifying an already-published older
    // release, and must still be a positive integer.
    expect(smokeWorkflow).toMatch(/EXPECTED_CONTRACT.*\^\[1-9\]\[0-9\]\*\$/)
  })

  it('keeps both production guards manually triggered only', () => {
    for (const workflow of [backupWorkflow, smokeWorkflow]) {
      expect(workflow).toContain('workflow_dispatch:')
      expect(workflow).not.toMatch(/^\s+(push|pull_request|schedule):/m)
    }
  })
})
