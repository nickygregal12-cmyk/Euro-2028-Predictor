import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The follow-up workflow's job is to get the hosted contract record onto
 * `main` after a successful development rollout. Opening a pull request is one
 * route there, and on 6 August 2026 it was refused: the repository forbids
 * GitHub Actions from creating pull requests, `set -euo pipefail` turned the
 * refusal into a job failure *after* the branch had been pushed, and a correct
 * contract-120 record sat on an automation branch while `main` went on telling
 * every agent that development was five contracts behind.
 *
 * The record was never wrong. Nobody was told where it was.
 *
 * These assertions pin the recovery path rather than the happy one, because
 * the happy one was never the problem.
 */

const root = process.cwd()
const workflow = readFileSync(
  resolve(root, '.github/workflows/development-hosted-status-followup.yml'),
  'utf8',
)

describe('the hosted-status follow-up cannot strand a record silently', () => {
  it('does not let a refused pull request fail the run', () => {
    // The push has already happened by this line. An unguarded `gh pr create`
    // under `set -e` discards a successful run's real output.
    expect(workflow).toMatch(/gh pr create[^\n]*\|\| pr_failed=1/)
  })

  it('announces the branch in the job summary when the pull request is refused', () => {
    expect(workflow).toContain('GITHUB_STEP_SUMMARY')
    expect(workflow).toMatch(/pull request NOT opened/i)
    // The recovery command names the branch rather than describing it.
    expect(workflow).toMatch(/gh pr create --base main --head \$\{branch\}/)
  })

  it('raises an issue, because a job summary is only seen by whoever opens the run', () => {
    expect(workflow).toContain('gh issue create')
    expect(workflow).toMatch(/permissions:[\s\S]*issues: write/)
  })

  it('never lets the issue fallback itself fail the job', () => {
    // Belt and braces: the summary is already written by this point, so a
    // second failure must not undo the first recovery route.
    expect(workflow).toMatch(/gh issue create[\s\S]{0,1600}?\|\| echo "::warning::/)
  })

  it('keeps the pull-request permission it already had', () => {
    // The permission was never the defect — the repository setting was — so a
    // future reader must not "fix" this by removing it.
    expect(workflow).toMatch(/permissions:[\s\S]*pull-requests: write/)
  })

  it('still writes the record from the repository rather than a typed number', () => {
    expect(workflow).toContain("require('./config/deployment-contract.json').requiredMigrationCount")
    expect(workflow).toMatch(/git ls-files 'supabase\/migrations\/\*\.sql'/)
  })

  it('runs only after a successful rollout', () => {
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'")
  })

  it('writes a record that states development and does not state production at all', () => {
    // This assertion has now been rewritten twice, and the second rewrite is
    // the interesting one.
    //
    // First the workflow wrote `productionContract = 63` — a literal, true when
    // typed and silently false from the next production rollout onwards, which
    // put four unmergeable contract-declaration changes on `origin` at once.
    // The fix pointed it at `config/production-hosted-contract.json`, and the
    // guard here pinned that it READ the value rather than restating it.
    //
    // Reading the right file was not enough, because the copy survived. This
    // job runs after a DEVELOPMENT rollout; a PRODUCTION rollout has nothing
    // that refreshes the copy. On 10 August 2026 `NOW.md` therefore reported
    // production at 145 while production stood at 151, and `npm run check:now`
    // agreed with it, because it regenerated from the same copy. A duplicated
    // fact with a one-directional check cannot be caught by that check.
    //
    // So the guard is now the absence of the copy. Every reader reads
    // production's own record at the point of use.
    expect(workflow).toContain('delete current.productionContract')
    expect(workflow).toContain('delete current.productionPromotionAuthorised')
    expect(workflow).not.toMatch(/current\.productionContract\s*=[^=]/)
    expect(workflow).not.toMatch(/current\.productionPromotionAuthorised\s*=[^=]/)
  })

  it('still reads production’s own record when it names production in the PR body', () => {
    // Reading it at the point of use is the whole point; what is forbidden is
    // writing the answer down somewhere a later reader might trust.
    expect(workflow).toContain(
      "require('./config/production-hosted-contract.json').requiredMigrationCount",
    )
  })
})
