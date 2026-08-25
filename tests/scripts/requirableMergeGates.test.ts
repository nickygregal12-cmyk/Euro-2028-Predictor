import { execFileSync } from 'node:child_process'
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

/** Workflows whose `changes` job left-trims heredoc path entries. */
const WORKFLOWS_WITH_TRIM = [
  '.github/workflows/browser-e2e.yml',
  '.github/workflows/cloud-conductor-smoke.yml',
  '.github/workflows/database-parity.yml',
] as const

type Gate = {
  /** The workflow file, relative to the repository root. */
  workflow: string
  /** The job `name:` a ruleset would match on — the check-run name, verbatim. */
  context: string
  /**
   * The jobs an aggregate gate must observe before it may report, or `null` where
   * the measuring job *is* the gate.
   *
   * Two families, and the difference is whether the workflow has anything that
   * can be skipped. A workflow whose real job may not run needs a separate job to
   * publish the context in its place, reporting under `always()` and deciding
   * inside; one unconditional job needs no such thing and is simply named the
   * context, which is what `migration-safety.yml` does.
   */
  needs: string | null
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
    // The most expensive thing in the repository: a local Supabase and a driven
    // browser, fifty minutes at the timeout. Nothing about this may run on a pull
    // request that owes it nothing, so the filter moved inward rather than away.
    workflow: '.github/workflows/browser-e2e.yml',
    context: 'Browser end-to-end / Required browser gate',
    needs: 'needs: [changes, authenticated-browser, deploy-preview-smoke]',
    shape: (workflow) => {
      expect(workflow).toContain("if: ${{ needs.changes.outputs.e2e == 'true' }}")
      expect(workflow).toContain("if: ${{ needs.changes.result != 'success' }}")
      expect(workflow).toContain('git diff --name-only "$BASE_SHA...$HEAD_SHA"')
      // `skipped` is tolerated for the preview smoke and nowhere else. That job
      // only runs for a pull request targeting `main`, so on another base its
      // absence is the right answer rather than missing evidence — while the
      // browser suite being absent is always missing evidence.
      expect(workflow).toContain("needs.deploy-preview-smoke.result != 'skipped'")
      expect(workflow).not.toContain("needs.authenticated-browser.result != 'skipped'")
      // The paths decision joined the base guard; it did not replace it.
      expect(workflow).toContain("github.base_ref == 'main'")
    },
  },
  {
    // One unconditional job that reads every tracked Markdown file rather than
    // the changed ones, so a pull request touching no Markdown costs exactly what
    // one rewriting it does. Nothing to gate, nothing to aggregate.
    workflow: '.github/workflows/link-integrity.yml',
    context: 'Documentation link integrity / Required link gate',
    needs: null,
    shape: (workflow) => {
      expect(workflow).not.toContain('needs.changes')
      // Reading the corpus is the reason no `changes` job was needed; a change to
      // read only the diff would quietly reintroduce the case this avoids.
      expect(workflow).toContain("git ls-files '*.md'")
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
    if (needs === null) {
      // Nothing here can be skipped, so the job that measures is the job that
      // reports and there is no second job to reconcile.
      expect(workflow).not.toContain('if: ${{ always() }}')
      return
    }
    // A gate that vanished on failure would be indistinguishable from one that
    // passed, so it reports unconditionally and decides inside.
    expect(workflow).toContain('if: ${{ always() }}')
    expect(workflow).toContain(needs)
  })

  it('treats red, cancelled and absent alike, because none of them is a pass', () => {
    if (needs === null) {
      // A single job's own conclusion *is* the verdict; there is no result to
      // reconcile and nothing that could report success on another's behalf.
      expect(workflow).not.toMatch(/needs\.[a-z-]+\.result/)
      return
    }
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

/**
 * THE TRIM THAT DECIDES WHETHER A `changes` JOB DECIDES ANYTHING.
 *
 * Every `changes` job feeds its path list through a heredoc, so each entry
 * arrives with the indentation of the YAML it was written in and has to be
 * left-trimmed before it can be used as a `case` pattern. The idiom is a
 * two-step parameter expansion, and it is one character away from silently
 * inverting the job's answer:
 *
 *   `%%` strips the LONGEST suffix starting at a non-space — the entry itself —
 *        leaving the indentation, which is then removed as a prefix. Correct.
 *   `%`  strips the SHORTEST such suffix — the final character. `  src/**`
 *        becomes `  src/*`, removing that as a prefix leaves `*`, and `case`
 *        matches every changed file. The job reports `true` for every pull
 *        request and the expensive suite it guards runs unconditionally.
 *
 * Found on #1048, where `browser-e2e.yml` had the second form while the two
 * workflows beside it in the same diff had the first.
 *
 * CI CANNOT SEE THIS AND THAT IS THE POINT. Running a suite that was not owed
 * still produces a passing gate, so every check on that pull request was green.
 * The failure is only visible by executing the expansion, which is what this
 * does — the real line, lifted from the real workflow, run by the real shell.
 * A string assertion would have to guess the spelling; this cannot.
 */
describe('the heredoc path trim, executed rather than read', () => {
  const trimmers = WORKFLOWS_WITH_TRIM.map((workflow) => {
    const line = read(workflow)
      .split('\n')
      .find((candidate) => /entry="\$\{entry#"\$\{entry%/.test(candidate))
    return { workflow, line: line?.trim() }
  })

  it('finds a trim line in every workflow expected to have one, so the rest is not vacuous', () => {
    for (const { workflow, line } of trimmers) {
      expect(line, `${workflow} has no trim line`).toBeDefined()
    }
  })

  it.each(trimmers)('$workflow leaves the entry intact', ({ line }) => {
    const run = (entry: string) =>
      execFileSync('bash', ['-c', `entry=$1\n${line}\nprintf '%s' "$entry"`, 'bash', entry], {
        encoding: 'utf8',
      })

    // The indented case the trim exists for.
    expect(run('  src/**')).toBe('src/**')
    expect(run('      e2e/**')).toBe('e2e/**')
    // The unindented case, which the single-`%` form also corrupts — to `n`.
    // A fix reasoning only about leading whitespace would still fail here.
    expect(run('package.json')).toBe('package.json')
    // A pattern whose last character is not `*`, so the bug is not disguised.
    expect(run('  supabase/migrations')).toBe('supabase/migrations')
  })
})
