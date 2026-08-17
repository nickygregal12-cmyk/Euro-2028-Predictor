#!/usr/bin/env node

// Derives production guard expectations from committed repository authority.
//
// Most callers validate the repository deployment contract. The manual
// Production backup workflow is different: it must verify the database that is
// actually hosted before any future migration, even while main has advanced.
// GitHub exposes the workflow name as GITHUB_WORKFLOW, so that one caller is
// routed to the separately tested hosted-Production authority instead of
// incorrectly expecting the repository tip.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deriveProductionHostedExpectations,
  formatGithubEnv as formatProductionGithubEnv,
} from './production-hosted-contract-expectations.mjs'

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

  if (migrations.length !== contract.requiredMigrationCount) {
    throw new Error(
      `Repository has ${migrations.length} migrations but the deployment ` +
        `contract requires ${contract.requiredMigrationCount}. Reconcile the ` +
        'contract before running a production guard.',
    )
  }

  const latest = migrations.at(-1)
  const latestMatch = latest ? MIGRATION_FILE_NAME.exec(latest) : null
  if (!latestMatch) {
    throw new Error(
      `Could not derive a version and name from the latest migration ${latest}.`,
    )
  }
  const [, latestMigrationVersion, latestMigrationName] = latestMatch
  if (latestMigrationVersion === undefined || latestMigrationName === undefined) {
    throw new Error(
      `Could not derive a version and name from the latest migration ${latest}.`,
    )
  }

  return {
    contractVersion: contract.contractVersion,
    migrationCount: migrations.length,
    latestMigrationVersion,
    latestMigrationName,
  }
}

/**
 * @param {{
 *   contractVersion: number,
 *   migrationCount: number,
 *   latestMigrationVersion: string,
 *   latestMigrationName: string,
 * }} expectations
 */
export function formatGithubEnv(expectations) {
  return [
    `EXPECTED_CONTRACT=${expectations.contractVersion}`,
    `EXPECTED_MIGRATION_COUNT=${expectations.migrationCount}`,
    `EXPECTED_LATEST_MIGRATION_VERSION=${expectations.latestMigrationVersion}`,
    `EXPECTED_LATEST_MIGRATION_NAME=${expectations.latestMigrationName}`,
  ].join('\n')
}

export function deriveCliExpectations({
  workflowName = process.env.GITHUB_WORKFLOW,
  bootstrapProjectRef = process.env.EXPECTED_PROJECT_REF,
  root = repoRoot,
} = {}) {
  if (workflowName === 'Production backup') {
    const expectations = deriveProductionHostedExpectations({ root })

    // The workflow needs a project ref before checkout so it can fail early on
    // a wrongly scoped database secret. That bootstrap value is therefore a
    // second representation of the same fact. Refuse the backup before any
    // dump when it has drifted from the committed hosted-production record.
    if (
      typeof bootstrapProjectRef === 'string' &&
      bootstrapProjectRef.length > 0 &&
      bootstrapProjectRef !== expectations.projectRef
    ) {
      throw new Error(
        `Production backup bootstrap project ref ${bootstrapProjectRef} does not match ` +
          `the hosted Production contract ${expectations.projectRef}.`,
      )
    }

    return {
      expectations,
      githubEnv: formatProductionGithubEnv(expectations),
      source: 'hosted Production contract',
    }
  }

  const expectations = deriveContractExpectations({ root })
  return {
    expectations,
    githubEnv: formatGithubEnv(expectations),
    source: 'repository deployment contract',
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { expectations, githubEnv } = deriveCliExpectations()
    console.log(
      process.argv.includes('--json')
        ? JSON.stringify(expectations, null, 2)
        : githubEnv,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Contract expectation derivation failed: ${message}`)
    process.exitCode = 1
  }
}
