import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * THE CONDUCTOR SMOKE HAS TO BE REQUIRABLE, AND THAT IS A SHAPE, NOT A SETTING.
 *
 * The branch ruleset is a hosted setting this clone cannot read, so this file
 * asserts the half that lives here: whether the workflow *could* safely be
 * required. Two failures bound the answer, and this workflow now meets both.
 *
 * A `paths:`-filtered workflow does not run on a pull request it does not match,
 * so its check never posts. Requiring such a context blocks every unrelated pull
 * request for ever — `DOC-001`, and again `OPS-012`. That is the loud failure.
 *
 * The quiet one is what leaving the filter in place costs: the context cannot be
 * required at all, so a change that breaks the Conductor's configuration merges
 * on a green core CI that never ran this smoke.
 *
 * Unlike `migration-safety.yml`, this job cannot decide for itself what changed —
 * it installs a CLI and loads agent definitions, which is minutes of work and no
 * cheaper for a pull request with nothing to measure. So it follows the
 * `database-parity.yml` shape instead: a cheap `changes` job holds the filter, the
 * smoke stays gated on its answer, and one always-reporting gate publishes the
 * context.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/cloud-conductor-smoke.yml'),
  'utf8',
)

const trigger = workflow.slice(workflow.indexOf('on:\n'), workflow.indexOf('permissions:'))
const pullRequestTrigger = trigger.slice(
  trigger.indexOf('pull_request:'),
  trigger.indexOf('  push:'),
)

describe('the Conductor gate can be required without blocking anything', () => {
  it('runs on every pull request rather than only on the paths it measures', () => {
    expect(pullRequestTrigger).toContain('pull_request:')
    // The filter that made this unrequirable. A trigger-level `paths:` on the
    // pull-request event is the single thing that stops the check posting.
    expect(pullRequestTrigger).not.toContain('paths:')
  })

  it('leaves the push filter alone, because a push posts no requirable context', () => {
    // Removing it there would buy nothing and would install a CLI on every
    // unrelated commit to `main` to prove nothing had changed.
    expect(trigger).toContain('  push:')
    expect(trigger.slice(trigger.indexOf('  push:'))).toContain('paths:')
  })

  it('publishes a stable context named the way a ruleset asks for it', () => {
    // A ruleset matches on the check-run name, which for Actions is the job's
    // `name:` alone — no workflow prefix is supplied for it. `CI / Required
    // merge gate` was renamed for exactly this reason after every pull request
    // sat waiting on a context nothing emitted.
    expect(workflow).toContain('name: Cloud conductor smoke / Required conductor gate')
    expect(workflow).toContain('if: ${{ always() }}')
    expect(workflow).toContain('needs: [changes, smoke]')
  })

  it('still spins the smoke only where the smoke is owed', () => {
    // Moving the filter must not turn this into a job that installs a CLI on
    // every pull request. The decision moved; it did not widen.
    expect(workflow).toContain("if: ${{ needs.changes.outputs.conductor == 'true' }}")
  })

  it('refuses an unanswered decision rather than reading it as nothing to do', () => {
    // An unrun `changes` job has an empty output, and empty is not 'true'. Without
    // this the gate would report success for a pull request nobody classified.
    expect(workflow).toContain("if: ${{ needs.changes.result != 'success' }}")
  })

  it('refuses a smoke that did not succeed where it was owed', () => {
    // Red, cancelled and absent are all "not proven", and a gate that passed on
    // any of them would be indistinguishable from one that measured something.
    expect(workflow).toContain("needs.smoke.result != 'success'")
  })

  it('asks what this branch changed, not how the two trees differ', () => {
    // `git diff A B` compares trees, so once the base advances it reports files
    // changed *on the base* as this branch's work. `A...B` diffs from the merge
    // base. `database-parity.yml` shipped with the two-dot form and had to be
    // corrected; this one is written from the corrected shape.
    expect(workflow).toContain('git diff --name-only "$BASE_SHA...$HEAD_SHA"')
    expect(workflow).not.toMatch(/git diff --name-only "\$BASE_SHA" "\$HEAD_SHA"/)
  })

  it('measures rather than guesses when there is no pull-request base', () => {
    expect(workflow).toContain('if [ -z "${BASE_SHA:-}" ]; then')
  })

  it('pins every external action it uses', () => {
    for (const action of workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
      expect(action[1]).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})
