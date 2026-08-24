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

  it('installs the centrally pinned OpenCode resolver before the isolated test loop', () => {
    const install = ci.indexOf('"opencode-ai@${version}"')
    const tests = ci.indexOf('npx vitest list --filesOnly --static-parse')
    expect(ci).toContain("require('./config/agent-tools.json').opencode.version")
    expect(install).toBeGreaterThan(-1)
    expect(tests).toBeGreaterThan(install)
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

/**
 * THE vNEXT BROWSER GATE, AND WHY ITS SHAPE IS ASSERTED RATHER THAN TRUSTED.
 *
 * `OPS-012` recorded that the suite proving a vNext stage's layout contract is
 * not a merge condition, and that the obvious fix — adding its context to the
 * ruleset — is the one thing that must not be done, because a `paths:`-filtered
 * workflow does not run at all on a pull request it does not match, so a
 * required context that never posts blocks that pull request for ever. The
 * repository has already lost a day to that class of failure under `DOC-001`.
 *
 * The finding's own closure named the way out: *"the path-scoped workflow gains
 * a companion job that always reports a conclusion (success when its paths did
 * not match) and THAT becomes required"*. The gate itself now has that
 * property, which is the same thing with one context rather than two.
 *
 * These cases hold the three properties that make it safe to require. Each one
 * of them, reversed, reintroduces exactly one of the failures above.
 */
const vnextWorkshop = readFileSync(
  resolve(repositoryRoot, '.github/workflows/vnext-workshop.yml'),
  'utf8',
)

describe('the vNext browser gate can be required without blocking anything', () => {
  it('runs on every pull request rather than only on the paths it measures', () => {
    const trigger = vnextWorkshop.slice(
      vnextWorkshop.indexOf('on:'),
      vnextWorkshop.indexOf('jobs:'),
    )
    expect(trigger).toContain('pull_request:')
    // THE FILTER MOVED INSIDE. A workflow-level `paths:` is what makes a
    // required context impossible to satisfy on a pull request that does not
    // match it.
    expect(trigger).not.toContain('paths:')
  })

  it('reports a conclusion whatever the shards did, including not running', () => {
    // `always()` rather than `!cancelled()`: a gate that vanished when a shard
    // failed would be indistinguishable, to a ruleset, from one that passed.
    const gate = vnextWorkshop.slice(vnextWorkshop.indexOf('  layout:'))
    expect(gate).toContain('name: vNext merged browser gate')
    expect(gate).toContain('if: ${{ always() }}')
    expect(gate).toContain('needs: [changes, shard]')
  })

  it('fails unless the shards actually succeeded where they were owed', () => {
    // The propagation is the whole point. Without it the gate would be an
    // always-green context, which is worse than no context at all: it would
    // satisfy the programme's stage-transition requirement while the evidence
    // was red, cancelled or absent.
    const gate = vnextWorkshop.slice(vnextWorkshop.indexOf('  layout:'))
    expect(gate).toContain("needs.changes.outputs.vnext == 'true' && needs.shard.result != 'success'")
    // And an unanswered decision is not "nothing to measure": an empty output
    // is not `'true'`, so without this the gate would pass a pull request
    // nobody had classified.
    expect(gate).toContain("needs.changes.result != 'success'")
  })
})
