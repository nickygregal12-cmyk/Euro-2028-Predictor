import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every committed TypeScript source belongs to a compiler project.
 *
 * `tsc -b` checks the projects the root config references and nothing else, so
 * a directory that no project includes is not "passing" — it is unexamined, and
 * it looks identical to passing from CI. That gap has now been found three
 * separate times:
 *
 *   - `tests/` (170 files) was outside every project until PR #255, which
 *     surfaced sixteen errors including two assertions that could never fail;
 *   - `e2e/` and `scripts/**` followed in PR #258;
 *   - `production-smoke/` — the spec that asserts production is not pointed at
 *     the development Supabase project — was still uncovered after both.
 *
 * Each was found by hand. This test is what makes the next one fail instead.
 *
 * It works from `git ls-files`, so a new directory of TypeScript is caught the
 * moment it is committed, not when someone thinks to look.
 */

const repositoryRoot = process.cwd()

/** Roots covered by the referenced projects, as declared in their `include`. */
const COVERED_PREFIXES = [
  'src/',
  '.storybook/',
  'tests/',
  'e2e/',
  'production-smoke/',
  'scripts/',
  'supabase/functions/',
] as const

/** Individually-named root files. */
const COVERED_FILES = [
  'vite.config.ts',
  'vite.analyze.config.ts',
  'vitest.storybook.config.ts',
  'playwright.config.ts',
  'playwright.auth.config.ts',
  'playwright.production.config.ts',
  'playwright.visual.config.ts',
  'playwright.euro.config.ts',
  'playwright.vnext.config.ts',
] as const

function committedTypeScriptSources(): string[] {
  return execFileSync('git', ['ls-files', '*.ts', '*.tsx'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
}

function projectReferences(): string[] {
  const root = JSON.parse(readFileSync(resolve(repositoryRoot, 'tsconfig.json'), 'utf8')) as {
    references: { path: string }[]
  }
  return root.references.map((reference) => reference.path)
}

/**
 * `tsconfig.*.json` files carry both `//` and block comments, so they are not
 * plain JSON.
 *
 * Stripping them with a regex gets this wrong in a way that is easy to miss:
 * `tsconfig.tools.json` includes the glob `"scripts/**` + `/*.ts"`, whose `/*`
 * sits inside a string. A naive block-comment pattern starts a comment there
 * and swallows the rest of the include list. So the scanner tracks string state
 * and only treats a delimiter as a comment when it is outside one.
 */
function stripJsonComments(source: string): string {
  let output = ''
  let inString = false
  let inLine = false
  let inBlock = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (inLine) {
      if (character === '\n') {
        inLine = false
        output += character
      }
      continue
    }
    if (inBlock) {
      if (character === '*' && next === '/') {
        inBlock = false
        index += 1
      }
      continue
    }
    if (inString) {
      if (character === '\\') {
        output += character + (next ?? '')
        index += 1
        continue
      }
      if (character === '"') inString = false
      output += character
      continue
    }
    if (character === '"') {
      inString = true
      output += character
      continue
    }
    if (character === '/' && next === '/') {
      inLine = true
      index += 1
      continue
    }
    if (character === '/' && next === '*') {
      inBlock = true
      index += 1
      continue
    }
    output += character
  }

  return output
}

function readProjectConfig(file: string): {
  extends?: string
  compilerOptions?: Record<string, unknown>
} {
  const source = stripJsonComments(readFileSync(resolve(repositoryRoot, file), 'utf8'))
  return JSON.parse(source) as {
    extends?: string
    compilerOptions?: Record<string, unknown>
  }
}

const sources = committedTypeScriptSources()

describe('TypeScript project coverage', () => {
  it('reads a plausible number of sources at all', () => {
    expect(sources.length).toBeGreaterThan(400)
  })

  it('assigns every committed TypeScript source to a project', () => {
    const uncovered = sources
      .filter(
        (file) =>
          !COVERED_PREFIXES.some((prefix) => file.startsWith(prefix)) &&
          !(COVERED_FILES as readonly string[]).includes(file),
      )
      .sort()

    expect(uncovered).toEqual([])
  })

  it('references every project from the root config', () => {
    expect(projectReferences().sort()).toEqual([
      './tsconfig.app.json',
      './tsconfig.gates.json',
      './tsconfig.node.json',
      './tsconfig.test.json',
      './tsconfig.tools.json',
    ])
  })
})

describe('JavaScript under scripts/', () => {
  const CHECKED = [
    'scripts/check-documentation-authorities.mjs',
    'scripts/check-knip-baseline.mjs',
    'scripts/check-migration-additive.mjs',
    'scripts/check-workflow-action-pins.mjs',
    'scripts/check-bundle-budget.mjs',
    'scripts/check-hosted-migration-inventory.mjs',
    'scripts/deployment-contract-expectations.mjs',
    'scripts/production-hosted-contract-expectations.mjs',
    'scripts/production-site-session.mjs',
    'scripts/wait-for-production-release.mjs',
    'scripts/write-production-storage-state.mjs',
    'scripts/generate-database-types.mjs',
    'scripts/generate-now.mjs',
    'scripts/list-notification-workflows.mjs',
    'scripts/og/generate-site-icons.mjs',
    'scripts/reset-development-seed.mjs',
    'scripts/run-lighthouse.mjs',
    'scripts/select-browser-journeys.mjs',
    'scripts/validate-deployment-contract.mjs',
    'scripts/validate-netlify-environment.mjs',
  ] as const

  /**
   * Deliberately not checked yet. New operational scripts may be classified
   * here with `null` until their checkJs backlog is deliberately measured; this
   * keeps the coverage decision explicit instead of letting a new script join
   * the deferred set silently.
   */
  const DEFERRED = [
    ['scripts/agent-tools/graphify-input-fingerprint.mjs', null],
    ['scripts/agent-tools/route-task.mjs', null],
    ['scripts/check-fixtures.mjs', 29],
    ['scripts/check-migration-timestamps.mjs', 10],
    ['scripts/database-rollout/rehearse-production-batch-a.mjs', null],
    ['scripts/database-rollout/rehearse-production-batch-b.mjs', null],
    ['scripts/og/renderAssets.js', 61],
    ['scripts/ops/build-provider-team-profile-backfill.mjs', null],
    ['scripts/ops/create-verified-supabase-backup.mjs', 31],
    ['scripts/ops/run-stage-c1-hosted-postflight.mjs', 5],
    ['scripts/ops/run-stage-c1-hosted-preflight.mjs', 3],
    ['scripts/ops/stage-c1-evidence-lib.mjs', 41],
    ['scripts/production-health.mjs', null],
    ['scripts/production-smoke.mjs', 28],
  ] as const

  it('accounts for every committed JavaScript file under scripts/', () => {
    const committed = execFileSync(
      'git',
      ['ls-files', 'scripts/*.mjs', 'scripts/**/*.mjs', 'scripts/*.js', 'scripts/**/*.js'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
      },
    )
      .split('\n')
      .filter(Boolean)
      .sort()

    const accounted = [...CHECKED, ...DEFERRED.map(([file]) => file)].sort()

    expect(committed).toEqual(accounted)
  })

  it('checks exactly the declared typechecked inventory', () => {
    const gates = JSON.parse(
      stripJsonComments(readFileSync(resolve(repositoryRoot, 'tsconfig.gates.json'), 'utf8')),
    ) as { files: string[]; compilerOptions: Record<string, unknown> }

    expect(gates.files.sort()).toEqual([...CHECKED].sort())
    expect(gates.compilerOptions.allowJs).toBe(true)
    expect(gates.compilerOptions.checkJs).toBe(true)
  })
})

describe('TypeScript strictness', () => {
  it('states strict rather than inheriting it', () => {
    for (const project of ['tsconfig.app.json', 'tsconfig.node.json']) {
      expect(readProjectConfig(project).compilerOptions?.strict).toBe(true)
    }
  })

  it('keeps the derived projects extending the strict base', () => {
    for (const project of ['tsconfig.test.json', 'tsconfig.tools.json']) {
      const config = readProjectConfig(project)
      expect(config.extends).toBe('./tsconfig.app.json')
      expect(config.compilerOptions?.strict).toBeUndefined()
    }
  })
})
