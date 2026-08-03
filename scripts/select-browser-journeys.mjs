#!/usr/bin/env node
/**
 * Chooses which authenticated browser journeys a change has to run (ADR 0024).
 *
 * The suite takes over twenty minutes because every change runs every journey.
 * ADR 0024 narrows that: focused changes run focused journeys, and shell-wide,
 * auth-wide, schema and contract changes still run everything.
 *
 * THE SAFETY RULE, and the reason this file is shaped the way it is: narrowing
 * must be EARNED, never assumed. A path this module does not recognise widens
 * the run back to the full suite. There is no "probably fine" branch. A test
 * gate that silently stops running the journey which would have caught a
 * regression is worse than a slow one, because it still reports green.
 *
 * So the only way to run a subset is for EVERY changed path to match a rule
 * that names the journeys it affects. One unrecognised path, one shell path,
 * one schema path — full suite.
 *
 * Output: the spec files to pass to Playwright, or nothing at all, which the
 * workflow treats as "run everything".
 */

import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Paths that always run the whole suite. These are the shell, the harness, the
 * schema and the contract: changes here can move any journey, so none may be
 * skipped. Listed as prefixes; a changed path starting with one widens the run.
 */
export const ALWAYS_FULL_SUITE = [
  'supabase/', // schema, RPCs, RLS, seed — can empty any authenticated surface
  'config/deployment-contract.json',
  '.github/workflows/',
  'playwright.config.ts',
  'playwright.auth.config.ts',
  'playwright.production.config.ts',
  'e2e/global-setup.ts', // provisions every identity
  'e2e/seed-contract.ts',
  'e2e/local-supabase.ts',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'index.html',
  'netlify.toml',
  'public/',
  'src/app/', // routing and shell
  'src/services/supabase/', // every surface reads through this
  'src/design-system/',
  'src/features/shared/',
]

/**
 * Source areas mapped to the journeys that cover them. A changed path under a
 * prefix runs exactly those specs.
 *
 * Every entry must name specs that exist — `browserJourneySelection.test.ts`
 * checks that, and checks that every spec on disk is reachable, so a new
 * journey cannot be silently unreachable from any change.
 */
export const JOURNEY_MAP = [
  {
    prefix: 'src/features/games/',
    specs: ['bonus-games.spec.ts'],
  },
  {
    prefix: 'src/features/bracket/',
    specs: ['bracket-conflict.spec.ts'],
  },
  {
    prefix: 'src/features/admin/',
    specs: ['admin-results.spec.ts', 'operating-cap.spec.ts'],
  },
  {
    prefix: 'src/features/league/',
    specs: ['private-league-invite.spec.ts', 'private-league-pagination.spec.ts'],
  },
  {
    prefix: 'src/features/leagues/',
    specs: [
      'private-league-invite.spec.ts',
      'private-league-pagination.spec.ts',
      'overall-standings.spec.ts',
    ],
  },
  {
    prefix: 'src/features/scoring/',
    specs: ['overall-standings.spec.ts'],
  },
  {
    prefix: 'src/features/matches/',
    specs: [
      'matches-tournament-info.spec.ts',
      'match-centre-navigation.spec.ts',
      'foreground-refresh.spec.ts',
    ],
  },
  {
    prefix: 'src/features/predict/',
    specs: [
      'authenticated-browser.spec.ts',
      'entry-creation.spec.ts',
      'locked-state.spec.ts',
      'automatic-submission.spec.ts',
    ],
  },
  {
    prefix: 'src/features/home/',
    specs: ['authenticated-browser.spec.ts'],
  },
  {
    prefix: 'src/features/hub/',
    specs: ['authenticated-browser.spec.ts'],
  },
  {
    prefix: 'src/features/profile/',
    specs: ['profile-h2h-surfaces.spec.ts'],
  },
  {
    prefix: 'src/features/h2h/',
    specs: ['profile-h2h-surfaces.spec.ts'],
  },
  {
    prefix: 'src/features/trends/',
    specs: ['prediction-trends.spec.ts'],
  },
  {
    prefix: 'src/features/account/',
    specs: ['authenticated-browser.spec.ts'],
  },
  {
    prefix: 'src/domain/',
    // Domain rules feed the surfaces that render them; the accessibility and
    // capacity journeys do not read domain output.
    specs: [
      'authenticated-browser.spec.ts',
      'locked-state.spec.ts',
      'automatic-submission.spec.ts',
      'overall-standings.spec.ts',
    ],
  },
]

/** Specs that run whenever any subset runs — the always-on floor. */
export const BASELINE_SPECS = ['route-accessibility.spec.ts', 'axe-accessibility.spec.ts']

/**
 * A changed e2e spec runs itself. A shared `-local.ts` helper is used by
 * several specs, so it widens rather than guessing which.
 *
 * @param {string} path
 * @returns {string[] | null}
 */
function specForE2eFile(path) {
  const file = path.slice('e2e/'.length)
  if (file.endsWith('.spec.ts')) return [file]
  return null
}

/**
 * Decide the run. Returns `{ full: true }` or `{ full: false, specs }`.
 *
 * `full` is the answer for anything unrecognised, by construction: the loop
 * returns early on the first path it cannot account for.
 *
 * @param {readonly string[]} changedPaths
 * @returns {{ full: boolean, reason?: string, specs?: string[] }}
 */
export function selectJourneys(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
    // No detectable change list is not evidence of a small change.
    return { full: true, reason: 'no changed paths were supplied' }
  }

  const specs = new Set(BASELINE_SPECS)

  for (const path of changedPaths) {
    if (ALWAYS_FULL_SUITE.some((prefix) => path === prefix || path.startsWith(prefix))) {
      return { full: true, reason: `${path} can affect every journey` }
    }

    if (path.startsWith('e2e/')) {
      const own = specForE2eFile(path)
      if (own === null) {
        return { full: true, reason: `${path} is a shared browser fixture` }
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

    // Documentation, tests, tooling and anything unforeseen. Docs could be
    // narrowed further, but the workflow's own trigger filter already keeps
    // this job off pure documentation changes, so widening here costs nothing
    // and keeps the rule single: unrecognised means full.
    return { full: true, reason: `${path} is not mapped to any journey` }
  }

  return { full: false, specs: [...specs].sort() }
}

/** Spec files present on disk, for the guard test and reachability checks. */
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
    // A failed diff is not evidence of a small change either.
    console.error('Could not determine changed paths; running the full suite.')
    process.stdout.write('')
    process.exit(0)
  }

  const decision = selectJourneys(changed)
  // `!decision.specs` is not defensive noise: a decision that claims to be
  // narrow while carrying no journeys would otherwise print an empty filter,
  // and the workflow would read that as the full suite anyway. Widening here
  // keeps the fail-open rule true in one place rather than two.
  if (decision.full || !decision.specs || decision.specs.length === 0) {
    console.error(`Running the full browser suite: ${decision.reason ?? 'no journeys selected'}.`)
    process.stdout.write('')
  } else {
    console.error(`Running ${decision.specs.length} targeted journeys.`)
    process.stdout.write(decision.specs.join(' '))
  }
}
