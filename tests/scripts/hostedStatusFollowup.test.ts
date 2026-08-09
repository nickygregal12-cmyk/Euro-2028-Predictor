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

  it('runs only after a successful rollout, and reads production rather than restating it', () => {
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'")

    // These two lines used to be asserted as the literals `productionContract =
    // 63` and `productionPromotionAuthorised = false`. Pinning the literal is
    // what let it rot: 63 was production's contract when it was written, and
    // from the next production rollout onwards every run of this job proposed
    // rewriting a correct 132 back down to it. Four such pull requests were
    // open simultaneously, each one an unapproved contract-declaration change,
    // and the correct development half of each record could not be merged
    // without the wrong production half. The guard now asserts the shape that
    // cannot rot — that both values are READ from the production hosted
    // record, which is their authority — for the same reason the development
    // count above is read from `deployment-contract.json` rather than typed.
    expect(workflow).toContain("fs.readFileSync('config/production-hosted-contract.json', 'utf8')")
    expect(workflow).toContain('current.productionContract = production.requiredMigrationCount')
    expect(workflow).toContain(
      'current.productionPromotionAuthorised = production.promotionAuthorised === true',
    )
    expect(workflow).not.toMatch(/productionContract = \d+/)
  })
})
