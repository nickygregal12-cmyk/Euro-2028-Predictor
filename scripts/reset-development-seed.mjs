#!/usr/bin/env node
/**
 * One-command local development reset and republish (ADR 0024).
 *
 * Rebuilds the local Supabase database from the committed migration chain and
 * `supabase/seed.sql`, then reports what still has to happen for a seeded user
 * to be usable. Development data is disposable until a closed external cohort
 * begins; this is the command that makes disposing of it routine.
 *
 * Deliberately LOCAL ONLY. It refuses to run against anything but the standard
 * local stack, because `supabase db reset` destroys data and "I thought that
 * shell was pointed at local" is exactly how a hosted database gets wiped. The
 * hosted development rollout is a separate, guarded workflow — not this.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Hosted project refs that must never be the target of a destructive reset. */
const HOSTED_REFS = ['iouzoutneyjpugbbtdem', 'vkfnsqdyhvtwyqkisxhk']

function refuseHostedTargets() {
  const suspects = [
    ['SUPABASE_DB_URL', process.env.SUPABASE_DB_URL],
    ['SUPABASE_DEV_DB_URL', process.env.SUPABASE_DEV_DB_URL],
    ['E2E_SUPABASE_URL', process.env.E2E_SUPABASE_URL],
    ['VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL],
    ['SUPABASE_PROJECT_REF', process.env.SUPABASE_PROJECT_REF],
  ]

  for (const [name, value] of suspects) {
    if (!value) continue
    const hosted = HOSTED_REFS.find((ref) => value.includes(ref))
    if (hosted) {
      throw new Error(
        `${name} points at hosted project ${hosted}. This script resets a LOCAL ` +
          'database only. Use the guarded rollout workflow for hosted changes.',
      )
    }
    if (/^https?:\/\//.test(value)) {
      const { hostname } = new URL(value)
      if (!['127.0.0.1', 'localhost'].includes(hostname)) {
        throw new Error(`${name} points at non-local host ${hostname}; refusing to reset.`)
      }
    }
  }
}

function seedRequirements() {
  const source = readFileSync(resolve(repoRoot, 'e2e/seed-contract.ts'), 'utf8')
  const reviewed = /SEED_REVIEWED_AT_CONTRACT = (\d+)/.exec(source)?.[1] ?? 'unknown'
  const contract = JSON.parse(
    readFileSync(resolve(repoRoot, 'config/deployment-contract.json'), 'utf8'),
  )
  return { reviewed, current: String(contract.contractVersion) }
}

try {
  refuseHostedTargets()

  console.log('Resetting the local Supabase database from the committed migration chain…')
  execFileSync('supabase', ['db', 'reset'], { cwd: repoRoot, stdio: 'inherit' })

  const { reviewed, current } = seedRequirements()
  console.log('\nLocal database rebuilt and seeded.')
  console.log(
    'Auth identities are provisioned by the Playwright global setup from ' +
      'e2e/seed-contract.ts — run the browser suite, or import that module, to create them.',
  )
  if (reviewed !== current) {
    console.warn(
      `\nWARNING: the seed contract was last verified at database contract ${reviewed} ` +
        `but the repository is at ${current}. A seeded user may not be functional. ` +
        'See e2e/seed-contract.ts.',
    )
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Development seed reset failed: ${message}`)
  process.exitCode = 1
}
