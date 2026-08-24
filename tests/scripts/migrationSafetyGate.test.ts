import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * THE MIGRATION GATE HAS TO BE REQUIRABLE, AND THAT IS A SHAPE, NOT A SETTING.
 *
 * The branch ruleset is a hosted setting this clone cannot read, so this file
 * asserts the only half that lives here: whether the workflow *could* safely be
 * required. Two failures bound the answer, and the repository has met both.
 *
 * A `paths:`-filtered workflow does not run on a pull request it does not match,
 * so its check never posts. Requiring such a context blocks every unrelated pull
 * request for ever — `DOC-001`, and again `OPS-012`. That is the loud failure.
 *
 * The quiet one is what leaving the filter in place costs: the context cannot be
 * required at all, so a pull request carrying an unsafe migration merges on a
 * green core CI that never inspected it. Measured on 24 August 2026: `#1028`
 * (migrations) published `migration-transition` and `local-supabase`, while
 * `#1034` (no migrations, merged) published neither and merged regardless. Had
 * either been required, `#1034` could not have merged. So neither was.
 *
 * `vnext-workshop.yml` solved this by moving the filter inside and always
 * reporting. This workflow needs less machinery, because its job already decides
 * for itself what changed — it only had to stop being skipped before it could.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/migration-safety.yml'),
  'utf8',
)

const trigger = workflow.slice(workflow.indexOf('on:'), workflow.indexOf('permissions:'))

describe('the migration gate can be required without blocking anything', () => {
  it('runs on every pull request rather than only on the paths it lints', () => {
    expect(trigger).toContain('pull_request:')
    // The filter that made this unrequirable. A workflow-level `paths:` is the
    // single thing that stops the check from posting at all.
    expect(trigger).not.toContain('paths:')
  })

  it('publishes a stable context named the way a ruleset asks for it', () => {
    // A ruleset matches on the check-run name, which for Actions is the job's
    // `name:` alone — no workflow prefix is supplied for it. `CI / Required
    // merge gate` was renamed for exactly this reason after every pull request
    // sat waiting on a context nothing emitted.
    expect(workflow).toContain('name: Migration safety / Required migration gate')
  })

  it('reports success when no migration changed, rather than not reporting', () => {
    // Silence and success are the same thing to a ruleset only if the check
    // posts. This is the step that makes "nothing to lint" an actual answer.
    expect(workflow).toContain('Report success where no migration changed')
    expect(workflow).toContain("if: steps.changed.outputs.files == ''")
  })

  it('still lints only the migrations that actually changed', () => {
    // Removing the trigger filter must not turn this into a job that lints the
    // whole corpus on every pull request. The decision moved; it did not widen.
    expect(workflow).toContain("if: steps.changed.outputs.files != ''")
    expect(workflow).toContain("-- 'supabase/migrations/*.sql'")
  })

  it('derives the comparison from the pull request, not from a guess', () => {
    expect(workflow).toContain('BASE_SHA: ${{ github.event.pull_request.base.sha }}')
    expect(workflow).toContain('HEAD_SHA: ${{ github.event.pull_request.head.sha }}')
    // Every trigger this workflow declares supplies those, so the diff below
    // cannot run against an empty base. Adding `workflow_dispatch:` here without
    // guarding the empty SHA would fail the job under `set -euo pipefail`.
    expect(trigger).not.toContain('workflow_dispatch:')
  })

  it('pins every external action it uses', () => {
    for (const action of workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
      expect(action[1]).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})
