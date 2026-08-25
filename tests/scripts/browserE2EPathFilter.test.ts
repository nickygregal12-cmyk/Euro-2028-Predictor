import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * Whether the browser suite runs at all.
 *
 * `browser-e2e.yml` is filtered by a hand-written path list. A pull request
 * touching none of those paths does not run the browser suite or the protected
 * deploy-preview verification.
 *
 * The list must therefore contain every repository path that materially changes
 * either the disposable browser harness or the Netlify preview identity and
 * protection boundary.
 *
 * The list moved off the trigger and into the `changes` job, because a
 * `paths:`-filtered workflow posts no check on a pull request it does not match
 * and so could never be a required context. What the list has to cover did not
 * change, only where it is written — and now a pull request that owes nothing
 * here does appear, as a gate reporting success rather than as silence.
 */

const root = resolve(import.meta.dirname, '../..')
const workflowPath = '.github/workflows/browser-e2e.yml'
const workflow = readFileSync(resolve(root, workflowPath), 'utf8')

/** The path entries the `changes` job decides from. */
const watchedPaths = (() => {
  const block = /^ {6}E2E_PATHS: \|\n((?: {8}.*\n)+)/m.exec(workflow)?.[1] ?? ''
  return [...block.matchAll(/^ {8}(?!#)(\S+)\s*$/gm)].map((match) => at(match, 1))
})()

/** The configuration a guard of this harness would have to open. */
const HARNESS_CONFIGURATION = [
  workflowPath,
  'playwright.config.ts',
  'playwright.auth.config.ts',
  'playwright.production.config.ts',
]

/** Blank comments so a path named only in prose does not count as a read. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
}

/** Test files that actually open one of the harness configuration files. */
function readsHarnessConfiguration(source: string): boolean {
  const code = withoutComments(source)
  return HARNESS_CONFIGURATION.some((path) =>
    new RegExp(`(?:readFileSync|resolve|read)\\([^)]*'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(
      code,
    ),
  )
}

function testFilesUnder(directory: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      found.push(...testFilesUnder(full))
      continue
    }
    if (/\.test\.tsx?$/.test(entry.name)) found.push(relative(root, full))
  }
  return found
}

const harnessGuards = testFilesUnder(resolve(root, 'tests')).filter((path) =>
  readsHarnessConfiguration(readFileSync(resolve(root, path), 'utf8')),
)

describe('browser E2E path filter', () => {
  it('parses the trigger, so nothing below checks an empty list', () => {
    expect(watchedPaths.length).toBeGreaterThan(10)
    expect(watchedPaths).toContain('e2e/**')
    expect(watchedPaths).toContain('src/**')
  })

  it('watches only paths that exist', () => {
    const missing = watchedPaths.filter((entry) => !existsSync(resolve(root, entry.replace(/\/\*\*$/, ''))))

    expect(
      missing,
      `these trigger paths match nothing in the repository, so the change they ` +
        `name can never run the browser suite: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('treats a directory entry as a directory', () => {
    const wrong = watchedPaths.filter((entry) => {
      const target = resolve(root, entry.replace(/\/\*\*$/, ''))
      if (!existsSync(target)) return false
      return entry.endsWith('/**') !== statSync(target).isDirectory()
    })

    expect(wrong, 'trigger paths whose /** suffix disagrees with what is on disk').toEqual([])
  })

  it('watches what the protected deploy-preview verification depends on', () => {
    expect(workflow).toContain(
      'STATUS_CONTEXT: netlify/euro28predictor/deploy-preview',
    )
    expect(workflow).toContain(
      'EXPECTED_COMMIT: ${{ github.event.pull_request.head.sha }}',
    )
    expect(workflow).toContain('$PREVIEW_ORIGIN/release.json')

    // Contract changes can make Netlify's fatal prebuild validation fail, so
    // they must trigger the workflow that waits for the exact Netlify status.
    expect(watchedPaths).toContain('config/deployment-contract.json')

    // These files define the deployed shell, release identity and Netlify
    // protection/routing behaviour certified by the exact-head preview gate.
    for (const shell of ['index.html', 'public/**', 'netlify.toml']) {
      expect(watchedPaths, `the preview verification depends on ${shell}`).toContain(shell)
    }
  })

  it('watches every test that guards this harness', () => {
    const unwatched = harnessGuards.filter((path) => !watchedPaths.includes(path))

    expect(
      unwatched,
      `these tests read this workflow or a Playwright config, so they guard the ` +
        `browser harness, but editing them cannot run it: ${unwatched.join(', ')}`,
    ).toEqual([])
  })

  it('lists no test that has stopped guarding the harness', () => {
    const listedTests = watchedPaths.filter((entry) => /^tests\/.*\.test\.tsx?$/.test(entry))
    const stale = listedTests.filter((path) => !harnessGuards.includes(path))

    expect(stale, 'per-file test entries that no longer read the harness').toEqual([])
  })

  it('detects a guard, and declines to count a passing mention', () => {
    expect(readsHarnessConfiguration("const c = read('playwright.auth.config.ts')")).toBe(true)
    expect(readsHarnessConfiguration("const files = ['playwright.config.ts']")).toBe(false)
    expect(readsHarnessConfiguration("// see playwright.config.ts\nread('other.ts')")).toBe(false)
  })
})
