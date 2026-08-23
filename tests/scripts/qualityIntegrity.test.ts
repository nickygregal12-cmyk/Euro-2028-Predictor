import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compareRatchet,
  countTestControls,
  extractBundleBudgets,
  extractCoverageThresholds,
  extractDependencySeverity,
  extractMutationBreak,
  extractPlaywrightRetries,
  validateExceptionRecord,
} from '../../scripts/check-quality-integrity.mjs'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('quality-integrity ratchets', () => {
  it('reads the current quality floors and ceilings from their real authorities', () => {
    expect(extractCoverageThresholds(read('vite.config.ts'))).toEqual({
      statements: 90,
      branches: 83,
      functions: 95,
      lines: 92,
    })
    expect(extractMutationBreak(read('stryker.config.mjs'))).toBe(90)
    expect(extractBundleBudgets(read('scripts/check-bundle-budget.mjs'))).toEqual({
      entryChunkKb: 92,
      totalJsKb: 506,
      totalCssKb: 64,
    })
    expect(extractDependencySeverity(read('.github/workflows/dependency-review.yml'))).toBe('high')
  })

  it('treats lower floors, higher ceilings and less-sensitive dependency review as weaker', () => {
    expect(compareRatchet('coverage.lines', 92, 91, 'floor')).toEqual({
      id: 'coverage.lines',
      from: 92,
      to: 91,
    })
    expect(compareRatchet('bundle.totalJsKb', 506, 507, 'ceiling')).toEqual({
      id: 'bundle.totalJsKb',
      from: 506,
      to: 507,
    })
    expect(compareRatchet('dependency', 'high', 'critical', 'severity')).toEqual({
      id: 'dependency',
      from: 'high',
      to: 'critical',
    })
    expect(compareRatchet('coverage.lines', 92, 93, 'floor')).toBeNull()
    expect(compareRatchet('bundle.totalJsKb', 506, 500, 'ceiling')).toBeNull()
    expect(compareRatchet('dependency', 'high', 'moderate', 'severity')).toBeNull()
  })

  it('detects test suppression and focused-test controls but ignores comments', () => {
    expect(
      countTestControls(`
        // test.skip('comment only', () => {})
        /* describe.only('also comment only', () => {}) */
        it.skip('disabled', () => {})
        test.todo('later')
        describe.only('focused', () => {})
      `),
    ).toEqual({ suppressions: 2, focused: 1 })
  })

  it('reads CI retries from both conditional and fixed Playwright configs', () => {
    expect(extractPlaywrightRetries('retries: process.env.CI ? 1 : 0,')).toBe(1)
    expect(extractPlaywrightRetries('retries: 3,')).toBe(3)
    expect(extractPlaywrightRetries('workers: 1,')).toBe(0)
  })

  it('requires a substantive reason and repository evidence for an exception', () => {
    const valid = {
      id: 'bundle.totalJsKb',
      from: 506,
      to: 507,
      reason:
        'Measured feature growth is isolated to one lazy administrative chunk and does not affect first paint.',
      evidence: 'scripts/check-bundle-budget.mjs',
    }
    expect(validateExceptionRecord(valid, 'HEAD', () => true)).toBeNull()
    expect(
      validateExceptionRecord({ ...valid, reason: 'make CI green' }, 'HEAD', () => true),
    ).toMatch(/at least 40 characters/)
    expect(
      validateExceptionRecord({ ...valid, evidence: 'missing.md' }, 'HEAD', () => false),
    ).toMatch(/does not exist/)
  })

  it('wires the comparison into required main CI before dependency installation', () => {
    const ci = read('.github/workflows/ci.yml')
    const guard = ci.indexOf('node scripts/check-quality-integrity.mjs "$BASE_SHA" "$HEAD_SHA"')
    const install = ci.indexOf('run: npm ci')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(install)
    expect(ci).toContain('BASE_SHA: ${{ github.event.pull_request.base.sha }}')
    expect(ci).toContain('HEAD_SHA: ${{ github.event.pull_request.head.sha }}')
  })
})
