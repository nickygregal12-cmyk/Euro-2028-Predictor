#!/usr/bin/env node
/**
 * Chooses which authenticated browser journeys a change has to run (ADR 0024).
 * Narrowing must be earned. Unrecognised, shell, schema and contract changes
 * widen to the whole active weekly suite. Tournament-only browser journeys
 * whose routes were deliberately retired from the weekly frontend are retained
 * as parked Euro 2028 return evidence and are never selected against this App.
 */

import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const PARKED_EURO_SPECS = [
  'admin-results.spec.ts',
  'authenticated-browser.spec.ts',
  'automatic-submission.spec.ts',
  'bonus-games.spec.ts',
  'bracket-conflict.spec.ts',
  'entry-creation.spec.ts',
  'foreground-refresh.spec.ts',
  'locked-state.spec.ts',
  'match-centre-navigation.spec.ts',
  'matches-tournament-info.spec.ts',
  'operating-cap.spec.ts',
  'overall-standings.spec.ts',
  'prediction-trends.spec.ts',
  'private-league-invite.spec.ts',
]

export const ALWAYS_FULL_SUITE = [
  'supabase/',
  'config/deployment-contract.json',
  '.github/workflows/',
  'playwright.config.ts',
  'playwright.auth.config.ts',
  'playwright.production.config.ts',
  'e2e/global-setup.ts',
  'e2e/seed-contract.ts',
  'e2e/local-supabase.ts',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'index.html',
  'netlify.toml',
  'public/',
  'src/app/',
  'src/domain/',
  'src/services/supabase/',
  'src/design-system/',
  'src/features/shared/',
]

export const JOURNEY_MAP = [
  { prefix: 'src/features/admin/', specs: ['weekly-admin-access.spec.ts'] },
  { prefix: 'src/features/home/', specs: ['weekly-navigation.spec.ts'] },
  { prefix: 'src/features/hub/', specs: ['weekly-navigation.spec.ts'] },
  {
    prefix: 'src/features/league/',
    specs: ['private-league-pagination.spec.ts'],
  },
  {
    prefix: 'src/features/leagues/',
    specs: ['private-league-pagination.spec.ts'],
  },
  { prefix: 'src/features/profile/', specs: ['profile-h2h-surfaces.spec.ts'] },
  { prefix: 'src/features/h2h/', specs: ['profile-h2h-surfaces.spec.ts'] },
  { prefix: 'src/features/account/', specs: ['weekly-navigation.spec.ts'] },
]

export const BASELINE_SPECS = [
  'weekly-navigation.spec.ts',
  'route-accessibility.spec.ts',
  'axe-accessibility.spec.ts',
]

/**
 * @param {string} path
 * @returns {string[] | null}
 */
function specForE2eFile(path) {
  const file = path.slice('e2e/'.length)
  if (PARKED_EURO_SPECS.includes(file)) return null
  if (file.endsWith('.spec.ts')) return [file]
  return null
}

/**
 * @param {readonly string[]} changedPaths
 * @returns {{ full: boolean, reason?: string, specs?: string[] }}
 */
export function selectJourneys(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
    return { full: true, reason: 'no changed paths were supplied' }
  }

  const specs = new Set(BASELINE_SPECS)
  for (const path of changedPaths) {
    if (ALWAYS_FULL_SUITE.some((prefix) => path === prefix || path.startsWith(prefix))) {
      return { full: true, reason: `${path} can affect every weekly journey` }
    }

    if (path.startsWith('e2e/')) {
      const own = specForE2eFile(path)
      if (own === null) {
        return {
          full: true,
          reason: PARKED_EURO_SPECS.includes(path.slice('e2e/'.length))
            ? `${path} is parked Euro evidence and cannot narrow the weekly suite`
            : `${path} is a shared browser fixture`,
        }
      }
      own.forEach((spec) => specs.add(spec))
      continue
    }

    const mapped = JOURNEY_MAP.find(
      (entry) => path === entry.prefix || path.startsWith(entry.prefix),
    )
    if (mapped) {
      mapped.specs.forEach((spec) => specs.add(spec))
      continue
    }

    return { full: true, reason: `${path} is not mapped to any weekly journey` }
  }

  return { full: false, specs: [...specs].sort() }
}

export function specsOnDisk() {
  return readdirSync(resolve(repoRoot, 'e2e'))
    .filter((file) => file.endsWith('.spec.ts'))
    .sort()
}

if (process.argv[1] && process.argv[1].endsWith('select-browser-journeys.mjs')) {
  const base = process.argv[2]
  let changed = []
  try {
    changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
  } catch {
    console.error('Could not determine changed paths; running the full weekly suite.')
    process.stdout.write('')
    process.exit(0)
  }

  const decision = selectJourneys(changed)
  if (decision.full || !decision.specs || decision.specs.length === 0) {
    console.error(`Running the full weekly browser suite: ${decision.reason ?? 'no journeys selected'}.`)
    process.stdout.write('')
  } else {
    console.error(`Running ${decision.specs.length} targeted weekly journeys.`)
    process.stdout.write(decision.specs.join(' '))
  }
}
