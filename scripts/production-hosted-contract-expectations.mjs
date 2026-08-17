#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const MIGRATION_FILE_NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/

export function deriveProductionHostedExpectations({ root = repoRoot } = {}) {
  const record = JSON.parse(
    readFileSync(resolve(root, 'config/production-hosted-contract.json'), 'utf8'),
  )

  if (typeof record.projectRef !== 'string' || record.projectRef.length === 0) {
    throw new Error('Production hosted contract has no projectRef.')
  }
  if (!Number.isInteger(record.requiredMigrationCount) || record.requiredMigrationCount < 1) {
    throw new Error('Production hosted contract has an invalid requiredMigrationCount.')
  }
  if (record.promotionAuthorised !== false) {
    throw new Error('Backup authority must not imply production promotion is authorised.')
  }

  const migrations = readdirSync(resolve(root, 'supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort()

  if (record.requiredMigrationCount > migrations.length) {
    throw new Error(
      `Production hosted contract requires ${record.requiredMigrationCount} migrations, ` +
        `but the repository contains only ${migrations.length}.`,
    )
  }

  const hostedLatest = migrations[record.requiredMigrationCount - 1]
  const match = hostedLatest ? MIGRATION_FILE_NAME.exec(hostedLatest) : null
  if (!match) {
    throw new Error('Could not derive the hosted Production migration boundary.')
  }

  const [, latestMigrationVersion, latestMigrationName] = match
  if (latestMigrationVersion === undefined || latestMigrationName === undefined) {
    throw new Error('Could not derive the hosted Production migration boundary.')
  }
  if (
    latestMigrationVersion !== record.latestMigrationVersion ||
    latestMigrationName !== record.latestMigrationName
  ) {
    throw new Error(
      'Production hosted contract does not match the canonical migration at its recorded count.',
    )
  }

  return {
    projectRef: record.projectRef,
    migrationCount: record.requiredMigrationCount,
    latestMigrationVersion,
    latestMigrationName,
  }
}

/**
 * @param {{
 *   projectRef: string,
 *   migrationCount: number,
 *   latestMigrationVersion: string,
 *   latestMigrationName: string,
 * }} expectations
 */
export function formatGithubEnv(expectations) {
  return [
    `EXPECTED_PROJECT_REF=${expectations.projectRef}`,
    `EXPECTED_MIGRATION_COUNT=${expectations.migrationCount}`,
    `EXPECTED_LATEST_MIGRATION_VERSION=${expectations.latestMigrationVersion}`,
    `EXPECTED_LATEST_MIGRATION_NAME=${expectations.latestMigrationName}`,
  ].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const expectations = deriveProductionHostedExpectations()
    console.log(
      process.argv.includes('--json')
        ? JSON.stringify(expectations, null, 2)
        : formatGithubEnv(expectations),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Production hosted expectation derivation failed: ${message}`)
    process.exitCode = 1
  }
}
