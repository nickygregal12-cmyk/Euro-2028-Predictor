import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A GATE HAS TO BE REQUIRABLE, AND THAT IS A SHAPE, NOT A SETTING.
 *
 * The branch ruleset is a hosted setting this clone cannot read, so this file
 * asserts the half that lives here: whether each workflow *could* safely be
 * required. Two failures bound the answer.
 *
 * A `paths:`-filtered workflow does not run on a pull request it does not match,
 * so its check never posts. Requiring such a context blocks every unrelated pull
 * request for ever — `DOC-001`, and again `OPS-012`. That is the loud failure.
 *
 * The quiet one is what leaving the filter in place costs: the context cannot be
 * required at all, so a pull request that breaks the thing the workflow guards
 * merges on a green core CI that never inspected it. Measured on 24 August 2026
 * from merge history: `#1028` (migrations) published `migration-transition` and
 * `local-supabase`; `#1034` (no migrations) published neither and merged anyway.
 * Had either been required, `#1034` could not have merged. So neither was.
 *
 * This is a table because the shape repeats and the assertions do not deserve to
 * be pasted once per workflow. A converted workflow adds a row.
 * `migrationSafetyGate.test.ts` predates it and keeps its own file.
 */

const repositoryRoot = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8')

type Gate = {
  /** The workflow file, relative to the repository root. */
  workflow: string
  /** The job `name:` a ruleset would match on — the check-run name, verbatim. */
  context: string
  /** The jobs the gate must observe before it may report. */
  needs: string
  /** Assertions that belong to this workflow's shape rather than to all of them. */
  shape: (workflow: string) => void
}

const GATES: Gate[] = [
  {
    // Minutes of work — a CLI install and five agent definitions — so the filter
    // moved inward to a cheap `changes` job rather than being removed.
    workflow: '.github/workflows/cloud-conductor-smoke.yml',
    context: 'Cloud conductor smoke / Required conductor gate',
    needs: 'needs: [changes, smoke]',
    shape: (workflow) => {
      // The decision moved; it did not widen. An unrelated pull request must
      // still not install a CLI to prove nothing changed.
      expect(workflow).toContain("if: ${{ needs.changes.outputs.conductor == 'true' }}")
      // An unrun `changes` job has an empty output, and empty is not 'true'.
      // Without this the gate would pass a pull request nobody had classified.
      expect(workflow).toContain("if: ${{ needs.changes.result != 'success' }}")
      // THREE DOTS. `git diff A B` compares trees, so once the base advances it
      // reports files changed *on the base* as this branch's work.
      // `database-parity.yml` shipped with the two-dot form and had to be
      // corrected; this one is written from the corrected shape.
      expect(workflow).toContain('git diff --name-only "$BASE_SHA...$HEAD_SHA"')
      // A push posts no context a ruleset can require, so its filter is left in
      // place and still spares an unrelated commit to `main`.
      const trigger = workflow.slice(workflow.indexOf('on:\n'), workflow.indexOf('permissions:'))
      expect(trigger.slice(trigger.indexOf('  push:'))).toContain('paths:')
    },
  },
  {
    // Seconds of work, and each job already reads the pull request's own diff, so
    // there was nothing left for a filter to save and it is simply gone.
    workflow: '.github/workflows/security-tooling.yml',
    context: 'Security tooling / Required security gate',
    needs: 'needs: [betterleaks, actionlint, zizmor]',
    shape: (workflow) => {
      // Every pull request owes all three, so there is no "nothing to measure"
      // branch to get wrong.
      expect(workflow).not.toContain('needs.changes')
      // The scans read the branch, not the two trees.
      expect(workflow).not.toMatch(/git diff[^\n]*"\$BASE_SHA" "\$HEAD_SHA"/)
    },
  },
]

describe.each(GATES)('$context', ({ workflow: path, context, needs, shape }) => {
  const workflow = read(path)
  const trigger = workflow.slice(workflow.indexOf('on:\n'), workflow.indexOf('permissions:'))
  const pullRequestTrigger = trigger.slice(
    trigger.indexOf('pull_request:'),
    trigger.indexOf('  push:') === -1 ? undefined : trigger.indexOf('  push:'),
  )

  it('runs on every pull request rather than only on the paths it measures', () => {
    expect(pullRequestTrigger).toContain('pull_request:')
    // The one thing that stops the check posting at all.
    expect(pullRequestTrigger).not.toContain('paths:')
  })

  it('publishes a stable context named the way a ruleset asks for it', () => {
    // A ruleset matches on the check-run name, which for Actions is the job's
    // `name:` alone — no workflow prefix is supplied for it. `CI / Required
    // merge gate` was renamed for exactly this reason after every pull request
    // sat waiting on a context nothing emitted.
    expect(workflow).toContain(`name: ${context}`)
  })

  it('reports whatever the jobs did, including not running at all', () => {
    // A gate that vanished on failure would be indistinguishable from one that
    // passed, so it reports unconditionally and decides inside.
    expect(workflow).toContain('if: ${{ always() }}')
    expect(workflow).toContain(needs)
  })

  it('treats red, cancelled and absent alike, because none of them is a pass', () => {
    expect(workflow).toMatch(/result != 'success'/)
    expect(workflow).toContain('exit 1')
  })

  it('pins every external action it uses', () => {
    for (const action of workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
      expect(action[1]).toMatch(/^[0-9a-f]{40}$/)
    }
  })

  it('holds its shape', () => {
    shape(workflow)
  })
})
