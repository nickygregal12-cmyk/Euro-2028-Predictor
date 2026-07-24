#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const contractPath = resolve(repoRoot, 'config/deployment-contract.json')
const migrationsDir = resolve(repoRoot, 'supabase/migrations')

function readContract() {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))

  for (const field of ['contractVersion', 'requiredMigrationCount']) {
    if (!Number.isInteger(contract[field]) || contract[field] < 1) {
      throw new Error(`Deployment contract has invalid ${field}.`)
    }
  }

  if (!Array.isArray(contract.requiredRpcSignatures)) {
    throw new Error('Deployment contract must list requiredRpcSignatures.')
  }

  return contract
}

function countRepositoryMigrations() {
  return readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).length
}

export function validateDeploymentContract(env = process.env) {
  const contract = readContract()
  const migrationCount = countRepositoryMigrations()

  if (migrationCount !== contract.requiredMigrationCount) {
    throw new Error(
      `Repository has ${migrationCount} migrations but deployment contract ` +
        `requires ${contract.requiredMigrationCount}. Update and review the ` +
        'contract whenever the migration chain changes.',
    )
  }

  const isNetlify = env.NETLIFY === 'true'
  const context = env.CONTEXT?.trim()

  if (!isNetlify && !context) {
    return {
      checkedHostedContract: false,
      contractVersion: contract.contractVersion,
      migrationCount,
      message: 'Repository deployment contract verified; hosted check skipped.',
    }
  }

  if (!context) {
    throw new Error('Netlify build is missing CONTEXT.')
  }

  const deployedRaw = env.EURO28_DEPLOYED_DB_CONTRACT?.trim()
  if (!deployedRaw || !/^\d+$/.test(deployedRaw)) {
    throw new Error(
      `Netlify ${context} build is missing a valid ` +
        'EURO28_DEPLOYED_DB_CONTRACT value.',
    )
  }

  const deployedContract = Number.parseInt(deployedRaw, 10)
  if (deployedContract !== contract.contractVersion) {
    throw new Error(
      `Netlify ${context} database contract is ${deployedContract}, but the ` +
        `application requires ${contract.contractVersion}. Do not deploy until ` +
        'the target database is verified and the context value is updated.',
    )
  }

  return {
    checkedHostedContract: true,
    context,
    deployedContract,
    requiredContract: contract.contractVersion,
    migrationCount,
  }
}

try {
  const result = validateDeploymentContract()
  console.log(
    result.message ??
      `Netlify ${result.context} database contract ${result.deployedContract} verified.`,
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Deployment contract verification failed: ${message}`)
  process.exitCode = 1
}
