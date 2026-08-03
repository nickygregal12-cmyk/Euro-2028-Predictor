import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The floor under CI's unit-test step.
 *
 * CI does not run `vitest run`. For memory isolation it discovers the suite and
 * then runs each file in its own process:
 *
 *     npx vitest list --filesOnly --static-parse > "$test_files"
 *     test_count="$(wc -l < "$test_files")"
 *     while IFS= read -r test_file; do npm run test -- "$test_file"; done < "$test_files"
 *
 * The loop runs whatever discovery returned. Return nothing and it iterates zero
 * times, the step exits 0, and CI reports a pass on a suite that never ran.
 * `set -euo pipefail` does not help, because nothing failed: `vitest list` exits
 * 0 on an empty result, and a `while read` over an empty file is a no-op.
 *
 * This is not theoretical. Adding `'tests/**'` to `exclude` in `vite.config.ts`
 * — one line, in a file changed for ordinary reasons — takes discovery from 195
 * files to 0 and the step still succeeds. Every other gate in the workflow would
 * stay green too: the build, the lint, the bundle budget and the domain coverage
 * run against the source, not the suite.
 *
 * So the workflow refuses to proceed unless what Vitest discovered matches the
 * committed test files exactly, and this file keeps that mechanism honest.
 *
 * The expectation used to be a hand-written number, `minimum_test_files`. Two
 * things were wrong with it. It had to be raised by hand whenever a test file
 * was added, so that single line collided with every concurrent branch that
 * added tests — it re-conflicted the C1b PR three times in one day. And a count
 * cannot see a committed test file that discovery quietly stops returning,
 * which is the same silent-skip defect one level down.
 *
 * `git ls-files` supplies the expectation instead. It is independent of the
 * Vitest config, so a config change that breaks discovery cannot also move the
 * thing discovery is measured against.
 */

const root = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8')

/**
 * Test files on disk, under Vitest's own discovery rules.
 *
 * `vite.config.ts` keeps the default `include` and adds `e2e/**` and
 * `production-smoke/**` to `exclude`, because Playwright owns those. Counting
 * the same set here is what lets the floor be compared against reality rather
 * than against another hand-maintained number.
 */
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  'e2e',
  'production-smoke',
  'playwright-report',
  'playwright-report-auth',
  'test-results',
])

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/

function countTestFiles(directory: string): string[] {
  const found: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue
      found.push(...countTestFiles(resolve(directory, entry.name)))
      continue
    }
    if (TEST_FILE.test(entry.name)) found.push(relative(root, resolve(directory, entry.name)))
  }

  return found
}

const testFilesOnDisk = countTestFiles(root)

describe('CI unit-test discovery expectation', () => {
  it('finds the suite on disk, so the comparisons below are against something real', () => {
    // Without this, a walk that returned nothing would make every assertion
    // below compare zero to zero and pass.
    expect(testFilesOnDisk.length).toBeGreaterThan(100)
    expect(testFilesOnDisk).toContain('tests/scripts/ciTestDiscoveryFloor.test.ts')
    expect(testFilesOnDisk.filter((path) => path.startsWith('e2e/'))).toEqual([])
  })

  it('derives the expectation from git rather than from a hand-written number', () => {
    expect(workflow).toMatch(/git ls-files '\*\.test\.ts' '\*\.test\.tsx'/)
    // The number is gone. If it comes back, it brings the per-branch conflict
    // and the blind spot back with it.
    expect(
      workflow,
      'a hardcoded floor has returned; the expectation must stay derived',
    ).not.toMatch(/minimum_test_files=\d+/)
  })

  it('compares the two sets and fails the step rather than warning', () => {
    expect(workflow).toMatch(/diff -u "\$committed_files" "\$test_files"/)
    expect(
      workflow,
      'the comparison must fail the step, not print and continue',
    ).toMatch(/if ! diff -u[\s\S]*?exit 1/)
  })

  it('requires exact equality, so a file discovery drops is caught', () => {
    // A count comparison would pass if one file stopped being discovered while
    // another was added. Set equality is what closes that.
    const compareAt = workflow.indexOf('diff -u "$committed_files" "$test_files"')
    expect(compareAt).toBeGreaterThan(-1)
    expect(workflow).not.toMatch(/\$test_count" -lt/)
  })

  it('checks discovery before running the loop, not after', () => {
    // Ordering is the whole point: a check after the loop would run against a
    // list that has already been trusted to decide how much work to do.
    const compareAt = workflow.indexOf('diff -u "$committed_files" "$test_files"')
    const loopAt = workflow.indexOf('while IFS= read -r test_file')

    expect(loopAt).toBeGreaterThan(-1)
    expect(compareAt, 'the comparison must precede the per-file loop').toBeLessThan(loopAt)
  })

  it('refuses an expectation that is itself obviously wrong', () => {
    // If `git ls-files` returned almost nothing — not a checkout, a broken
    // pathspec — an empty expectation would match an empty discovery and the
    // step would pass having run no tests at all. This floor never needs
    // maintaining because it sits far below the real count and only catches
    // that collapse.
    const sanityFloor = Number(/sanity_floor=(\d+)/.exec(workflow)?.[1] ?? Number.NaN)

    expect(Number.isInteger(sanityFloor)).toBe(true)
    expect(sanityFloor).toBeGreaterThan(0)
    expect(
      sanityFloor,
      'the sanity floor must stay below the real suite or CI cannot pass',
    ).toBeLessThanOrEqual(testFilesOnDisk.length)
  })

  it('agrees with git about what the suite is', () => {
    // The workflow compares Vitest against git; this compares the on-disk walk
    // against git. If those two ever disagree, the workflow's expectation is
    // not the set this file has been reasoning about.
    const fromGit = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .sort()

    expect(fromGit).toEqual([...testFilesOnDisk].sort())
  })
})
