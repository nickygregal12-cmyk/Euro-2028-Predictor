#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const contractPath = resolve(repoRoot, 'config/deployment-contract.json')
/**
 * The one Netlify context whose database contract must match exactly, always.
 * Named rather than inlined so the production carve-out cannot be widened by
 * an innocent-looking edit to a comparison.
 */
const PRODUCTION_CONTEXT = 'production'
const migrationsDir = resolve(repoRoot, 'supabase/migrations')
const browserSourceDir = resolve(repoRoot, 'src')

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

/** @param {{ requiredRpcSignatures: string[] }} contract */
function declaredRpcNames(contract) {
  return contract.requiredRpcSignatures.map((signature) =>
    signature.replace(/^public\./, '').replace(/\(.*$/, ''),
  )
}

/** Every `supabase.rpc('name', …)` the browser bundle can reach. */
function calledRpcNames(directory = browserSourceDir, found = new Set()) {
  for (const entry of readdirSync(directory)) {
    const entryPath = join(directory, entry)
    if (statSync(entryPath).isDirectory()) {
      calledRpcNames(entryPath, found)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    const source = readFileSync(entryPath, 'utf8')
    for (const match of source.matchAll(/\.rpc\(\s*'([a-z0-9_]+)'/g)) {
      found.add(match[1])
    }
  }
  return found
}

/**
 * The contract exists so a deploy fails when the target database cannot serve
 * what the application requires. An RPC the browser calls but the contract does
 * not declare is outside that guarantee, so the allowlist must stay complete.
 *
 * Name-level on purpose: argument lists are checked against the committed
 * migrations in tests/scripts/deploymentContractRpcs.test.ts, where a parsing
 * disagreement fails CI instead of blocking a deploy.
 */
/** @param {{ requiredRpcSignatures: string[] }} contract */
function verifyRpcAllowlist(contract) {
  const declared = declaredRpcNames(contract)

  const duplicates = declared.filter(
    (name, index) => declared.indexOf(name) !== index,
  )
  if (duplicates.length > 0) {
    throw new Error(
      `Deployment contract declares duplicate RPCs: ${[...new Set(duplicates)].sort().join(', ')}.`,
    )
  }

  const declaredSet = new Set(declared)
  const undeclared = [...calledRpcNames()]
    .filter((name) => !declaredSet.has(name))
    .sort()

  if (undeclared.length > 0) {
    throw new Error(
      `The application calls ${undeclared.length} RPC(s) the deployment ` +
        `contract does not declare: ${undeclared.join(', ')}. Add each ` +
        'signature to requiredRpcSignatures, or stop calling it from src/.',
    )
  }

  return declared.length
}

export function validateDeploymentContract(env = process.env) {
  const contract = readContract()
  const migrationCount = countRepositoryMigrations()

  verifyRpcAllowlist(contract)

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
    /*
     * A non-production context whose database TRAILS the repository is the
     * ordinary state of a schema-advancing pull request, and failing it is a
     * circular gate: the development database can only reach the new contract
     * after the migration merges, so the preview can never go green before
     * merge (ADR 0024). The build proceeds and says what is unavailable.
     *
     * Everything else still fails. Production is never waved through, and a
     * database AHEAD of the application is not a pre-rollout state — it means
     * the target has migrations this build does not know about, which is a
     * real mismatch in either context.
     */
    const trailing = deployedContract < contract.contractVersion
    if (context !== PRODUCTION_CONTEXT && trailing) {
      return {
        checkedHostedContract: true,
        hostedDatabaseBehind: true,
        context,
        deployedContract,
        requiredContract: contract.contractVersion,
        migrationCount,
        message:
          `Netlify ${context} database contract is ${deployedContract} and the ` +
          `application requires ${contract.contractVersion}: hosted database ` +
          'preview unavailable until the development rollout applies it. ' +
          'Building anyway — database-backed smoke runs after that rollout.',
      }
    }

    throw new Error(
      `Netlify ${context} database contract is ${deployedContract}, but the ` +
        `application requires ${contract.contractVersion}. Do not deploy until ` +
        'the target database is verified and the context value is updated.',
    )
  }

  return {
    checkedHostedContract: true,
    hostedDatabaseBehind: false,
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
