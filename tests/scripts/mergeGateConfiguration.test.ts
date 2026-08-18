import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const ci = readFileSync(
  resolve(repositoryRoot, '.github/workflows/ci.yml'),
  'utf8',
)

describe('always-present merge gate', () => {
  it('runs on every pull request and merge-queue candidate', () => {
    const trigger = ci.slice(ci.indexOf('on:'), ci.indexOf('jobs:'))
    expect(trigger).toContain('pull_request:')
    expect(trigger).toContain('merge_group:')
    expect(trigger).not.toContain('paths:')
  })

  it('executes the fail-closed architecture wrapper in main CI', () => {
    expect(ci).toContain('bash scripts/agent-tools/architecture-check.sh')
    expect(ci.indexOf('architecture-check.sh')).toBeLessThan(
      ci.indexOf('npm run build'),
    )
  })

  it('publishes one stable aggregate result that fails unless CI succeeded', () => {
    expect(ci).toContain('merge-gate:')
    expect(ci).toContain('needs: ci')
    expect(ci).toContain("CI_RESULT: ${{ needs.ci.result }}")
    expect(ci).toContain('test "$CI_RESULT" = success')
  })

  it('names the gate job exactly as the ruleset requires it', () => {
    // A ruleset matches a status check by the CHECK-RUN NAME, which for Actions
    // is the job's `name:` with no workflow prefix supplied for it. `Protect
    // Main` requires `CI / Required merge gate`; the job was called `Required
    // merge gate`, so the ruleset waited on a check that was never going to
    // appear and `main` accepted no merges at all. Nothing failed -- every check
    // was green and the pull request simply said "expected" forever, which is
    // why this is asserted rather than left to be noticed.
    const required = readFileSync(
      resolve(repositoryRoot, 'specs/tooling-assurance-activation/plan.md'),
      'utf8',
    ).match(/require the always-present `([^`]+)` in the GitHub ruleset/)?.[1]

    expect(required).toBe('CI / Required merge gate')
    expect(ci).toContain(`name: ${required}`)
  })

  it('does not duplicate architecture analysis in a path-scoped workflow', () => {
    expect(
      existsSync(
        resolve(repositoryRoot, '.github/workflows/architecture-contracts.yml'),
      ),
    ).toBe(false)
  })

  it('pins every external action used by the required workflow', () => {
    for (const action of ci.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
      expect(action[1]).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})
