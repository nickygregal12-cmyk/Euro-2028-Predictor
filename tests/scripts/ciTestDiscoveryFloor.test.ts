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
 * So the workflow now refuses to proceed below a floor, and this file keeps the
 * floor honest. A floor nobody checks drifts to a number that cannot fail, which
 * is the same defect one level up.
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

/** The floor the workflow enforces, read back out of the workflow itself. */
const declaredFloor = Number(/minimum_test_files=(\d+)/.exec(workflow)?.[1] ?? Number.NaN)

/**
 * How far below the real count the floor may sit.
 *
 * Wide enough that deleting or consolidating a handful of files does not fail
 * CI for a legitimate change; narrow enough that the floor cannot quietly become
 * a number the suite would clear even after most of it stopped running. Crossing
 * it means raising the floor in `ci.yml` — a one-line, deliberate act.
 */
const MAXIMUM_SLACK = 25

describe('CI unit-test discovery floor', () => {
  it('finds the suite on disk, so the comparison below is against something real', () => {
    // Without this, a walk that returned nothing would make every assertion
    // below compare zero to zero and pass.
    expect(testFilesOnDisk.length).toBeGreaterThan(100)
    expect(testFilesOnDisk).toContain('tests/scripts/ciTestDiscoveryFloor.test.ts')
    expect(testFilesOnDisk.filter((path) => path.startsWith('e2e/'))).toEqual([])
  })

  it('enforces a floor at all', () => {
    expect(
      Number.isInteger(declaredFloor),
      'ci.yml no longer sets minimum_test_files — the Test step will report a ' +
        'pass on a suite that discovered nothing',
    ).toBe(true)

    expect(workflow, 'the floor must fail the step rather than warn').toMatch(
      /if \[ "\$test_count" -lt "\$minimum_test_files" \]; then[\s\S]*?exit 1/,
    )
  })

  it('checks the floor before running the loop, not after', () => {
    // Ordering is the whole point: a check after the loop would run against a
    // count that has already been trusted to decide how much work to do.
    const floorAt = workflow.indexOf('minimum_test_files=')
    const loopAt = workflow.indexOf('while IFS= read -r test_file')

    expect(floorAt).toBeGreaterThan(-1)
    expect(loopAt).toBeGreaterThan(-1)
    expect(floorAt, 'the floor check must precede the per-file loop').toBeLessThan(loopAt)
  })

  it('sets a floor the suite can actually clear', () => {
    expect(
      declaredFloor,
      `ci.yml requires at least ${declaredFloor} test files but only ` +
        `${testFilesOnDisk.length} exist — CI cannot pass`,
    ).toBeLessThanOrEqual(testFilesOnDisk.length)
  })

  it('keeps the floor close enough to the suite to mean something', () => {
    const slack = testFilesOnDisk.length - declaredFloor

    expect(
      slack,
      `the floor is ${declaredFloor} against ${testFilesOnDisk.length} test files ` +
        `on disk, so ${slack} files could stop being discovered before CI noticed. ` +
        `Raise minimum_test_files in .github/workflows/ci.yml.`,
    ).toBeLessThanOrEqual(MAXIMUM_SLACK)
  })
})
