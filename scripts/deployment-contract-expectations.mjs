#!/usr/bin/env node

// Derives the production guard expectations from committed repository
// authority instead of hand-maintained workflow literals.
//
// `config/deployment-contract.json` and `supabase/migrations/` are the only
// sources. Hardcoding these values into a workflow lets the guard drift
// silently behind the contract: a stale pin makes production smoke assert the
// wrong contract and makes the backup restore rehearsal fail its own
// migration-history check.
//
// Default output is `KEY=value` lines for `>> "$GITHUB_ENV"`. `--json` emits
// the same values as JSON for local inspection.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')

const MIGRATION_FILE_NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/

// `root` exists so the failure paths below can be tested against a fixture
// tree. Production callers use the default repository root.
export function deriveContractExpectations({ root = repoRoot } = {}) {
  const contractPath = resolve(root, 'config/deployment-contract.json')
  const migrationsDir = resolve(root, 'supabase/migrations')

  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))

  for (const field of ['contractVersion', 'requiredMigrationCount']) {
    if (!Number.isInteger(contract[field]) || contract[field] < 1) {
      throw new Error(`Deployment contract has invalid ${field}.`)
    }
  }

  const migrations = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  if (migrations.length === 0) {
    throw new Error('No migrations found under supabase/migrations.')
  }

  for (const name of migrations) {
    if (!MIGRATION_FILE_NAME.test(name)) {
      throw new Error(
        `Migration ${name} does not match <14-digit timestamp>_<snake_case>.sql, ` +
          'so its version and name cannot be derived.',
      )
    }
  }

  // Fail closed rather than emitting an expectation the repository contradicts.
  // `npm run prebuild` enforces the same equality; repeat it here because these
  // values are asserted against production, where a wrong guard is worse than
  // an absent one.
  if (migrations.length !== contract.requiredMigrationCount) {
    throw new Error(
      `Repository has ${migrations.length} migrations but the deployment ` +
        `contract requires ${contract.requiredMigrationCount}. Reconcile the ` +
        'contract before running a production guard.',
    )
  }

  const latest = migrations.at(-1)
  const [, latestMigrationVersion, latestMigrationName] =
    MIGRATION_FILE_NAME.exec(latest)

  return {
    contractVersion: contract.contractVersion,
    migrationCount: migrations.length,
    latestMigrationVersion,
    latestMigrationName,
  }
}

export function formatGithubEnv(expectations) {
  return [
    `EXPECTED_CONTRACT=${expectations.contractVersion}`,
    `EXPECTED_MIGRATION_COUNT=${expectations.migrationCount}`,
    `EXPECTED_LATEST_MIGRATION_VERSION=${expectations.latestMigrationVersion}`,
    `EXPECTED_LATEST_MIGRATION_NAME=${expectations.latestMigrationName}`,
  ].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const expectations = deriveContractExpectations()
    console.log(
      process.argv.includes('--json')
        ? JSON.stringify(expectations, null, 2)
        : formatGithubEnv(expectations),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Contract expectation derivation failed: ${message}`)
    process.exitCode = 1
  }
}
