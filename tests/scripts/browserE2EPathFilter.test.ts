import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Whether the browser suite runs at all.
 *
 * `browser-e2e.yml` is filtered by a hand-written `paths:` list. A pull request
 * touching none of those paths does not run the 108-test browser suite or the
 * deploy-preview smoke — and because a filtered-out workflow produces no check
 * run, nothing appears as skipped either. The absence is indistinguishable from
 * a workflow that does not apply, so the PR merges having never been near a
 * browser.
 *
 * That is the correct design; the list is what needs guarding. Two ways it goes
 * wrong, both silent:
 *
 * 1. **An entry that matches nothing.** A renamed directory or a typo — `e2ee/**`
 *    for `e2e/**` — leaves a plausible-looking line that can never fire. GitHub
 *    does not validate path filters against the repository.
 *
 * 2. **A path the jobs depend on that nobody listed.** Found on 31 July 2026:
 *    `deploy-preview-smoke` reads `contractVersion` straight out of
 *    `config/deployment-contract.json` and requires the preview's `release.json`
 *    to match it on both the application and hosted sides — while that file was
 *    not in the trigger list. A contract bump is the single change most likely
 *    to break that match, and on its own it did not run the job that checks it.
 *    `index.html`, `public/**` and `netlify.toml` were missing for the same
 *    reason: the preview smoke exercises the deployed shell they produce.
 *
 * The last rule below is derived rather than restated. A test that opens this
 * workflow or a Playwright config is a guard of this harness, so it must be able
 * to trigger it — which means a new guard cannot be written without being
 * listed. The list already named two such tests by hand, which is what made the
 * omission of a third easy to miss.
 */

const root = resolve(import.meta.dirname, '../..')
const workflowPath = '.github/workflows/browser-e2e.yml'
const workflow = readFileSync(resolve(root, workflowPath), 'utf8')

/** The `paths:` entries of the `pull_request` trigger. */
const watchedPaths = (() => {
  const block = /paths:\n((?:\s*(?:#[^\n]*|- '[^']+')\n)+)/.exec(workflow)?.[1] ?? ''
  return [...block.matchAll(/- '([^']+)'/g)].map((match) => match[1])
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

/**
 * Test files that actually open one of those files.
 *
 * The literal has to sit inside a read — `read('playwright.config.ts')` or
 * `resolve(root, '.github/workflows/browser-e2e.yml')`. Listing a filename in an
 * array, as `typescriptProjectCoverage.test.ts` does, is not opening it and does
 * not make that test a guard of this harness; charging it a forty-minute browser
 * run would be a cost with nothing behind it.
 */
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
    // `foo/**` against a file, or a bare `foo` against a directory, matches
    // differently from what the line reads as — a slower version of the same
    // failure, where the entry fires for some changes and not others.
    const wrong = watchedPaths.filter((entry) => {
      const target = resolve(root, entry.replace(/\/\*\*$/, ''))
      if (!existsSync(target)) return false
      return entry.endsWith('/**') !== statSync(target).isDirectory()
    })

    expect(wrong, 'trigger paths whose /** suffix disagrees with what is on disk').toEqual([])
  })

  it('watches what the deploy-preview smoke actually reads', () => {
    // Each of these is asserted against the workflow body rather than assumed,
    // so the requirement disappears if the job stops depending on it.
    expect(workflow).toContain("require('./config/deployment-contract.json').contractVersion")
    expect(watchedPaths).toContain('config/deployment-contract.json')

    expect(workflow).toContain('npm run smoke:production')
    for (const shell of ['index.html', 'public/**', 'netlify.toml']) {
      expect(watchedPaths, `the preview smoke exercises the shell ${shell} produces`).toContain(
        shell,
      )
    }
  })

  it('watches every test that guards this harness', () => {
    // Derived from what the tests open, not from a second list. Writing a new
    // guard without listing it here fails, which is how the third one was
    // missed while two were named by hand.
    const unwatched = harnessGuards.filter((path) => !watchedPaths.includes(path))

    expect(
      unwatched,
      `these tests read this workflow or a Playwright config, so they guard the ` +
        `browser harness, but editing them cannot run it: ${unwatched.join(', ')}`,
    ).toEqual([])
  })

  it('lists no test that has stopped guarding the harness', () => {
    // The other direction: a per-file entry left behind after the test stopped
    // reading the harness costs a browser run on every edit, for nothing.
    const listedTests = watchedPaths.filter((entry) => /^tests\/.*\.test\.tsx?$/.test(entry))
    const stale = listedTests.filter((path) => !harnessGuards.includes(path))

    expect(stale, 'per-file test entries that no longer read the harness').toEqual([])
  })

  it('detects a guard, and declines to count a passing mention', () => {
    // The detector's own positive control. Every assertion above passes when
    // `readsHarnessConfiguration` returns false for everything.
    expect(readsHarnessConfiguration("const c = read('playwright.auth.config.ts')")).toBe(true)
    expect(readsHarnessConfiguration("const files = ['playwright.config.ts']")).toBe(false)
    expect(readsHarnessConfiguration("// see playwright.config.ts\nread('other.ts')")).toBe(false)
  })
})
