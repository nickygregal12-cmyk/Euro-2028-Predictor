import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflowPath = resolve(repositoryRoot, '.github/workflows/database-parity.yml')
const workflow = readFileSync(workflowPath, 'utf8')
const paritySuiteDir = resolve(repositoryRoot, 'tests/database-parity')
const transitionSuiteDir = resolve(repositoryRoot, 'tests/migration-transition')

/**
 * The path entries the workflow actually declares.
 *
 * These moved out of the trigger's `paths:` into the `changes` job's
 * `PARITY_PATHS` block, so the workflow runs on every pull request and can
 * publish a required context. A `paths:`-filtered workflow does not run on a
 * pull request it does not match, so its check never posts, and a required
 * context that never posts blocks that pull request for ever.
 *
 * The list stayed a parseable block precisely so this stays readable. Comment
 * lines travelled with it and are skipped here, exactly as the job's own reader
 * skips them.
 */
function declaredFilters(): string[] {
  const block = /^ {6}PARITY_PATHS: \|\n((?: {8}.*\n)+)/m.exec(workflow)?.[1] ?? ''
  return [...block.matchAll(/^ {8}(?!#)(\S+)\s*$/gm)].map((match) => at(match, 1))
}

/**
 * Whether the declared filter list would run the workflow for a change under
 * `path`. An entry is either an exact file or a `dir/**` glob.
 */
function filterCovers(path: string): boolean {
  return declaredFilters().some((entry) => {
    if (entry === path) return true
    const glob = /^(.*)\/\*\*$/.exec(entry)?.[1]
    return glob !== undefined && (path === glob || path.startsWith(`${glob}/`))
  })
}

/**
 * Every repository path the parity suites actually read or import, derived from
 * their own source rather than restated here.
 *
 * WHY DERIVED. The assertions below this used to be five `toContain` calls for
 * five path literals, and on 17 August 2026 an adversarial pass showed what that
 * shape cannot do: `- 'src/domain/**'` and `- 'supabase/**'` — the migrations and
 * the domain logic, which are the two things database parity exists to compare —
 * were absent from those five, so deleting both from the workflow left the whole
 * suite green. A list of literals only ever guards the literals someone
 * remembered, and the ones nobody remembered are the ones that go missing.
 *
 * Deriving the requirement from what the suites consume closes the class instead
 * of the instance: a new parity test that reads a new area fails this assertion
 * until the trigger covers that area. It also found three gaps the literals
 * missed — `config/development-hosted-contract.json`, `scripts/bonus-games/**`
 * and `src/services/supabase/**`, each read by a parity test whose result the
 * trigger would not have re-run.
 *
 * Only quoted string literals count. Paths named in prose use backticks in this
 * repository, and a comment mentioning a file is not the suite depending on it.
 */
function consumedPaths(): string[] {
  const pattern =
    /['"]((?:\.\.\/)*(?:src|supabase|config|scripts|fixtures)\/[A-Za-z0-9_./-]+)['"]/g
  const found = new Set<string>()

  for (const directory of [paritySuiteDir, transitionSuiteDir]) {
    for (const file of readdirSync(directory)) {
      if (!file.endsWith('.ts')) continue
      const source = readFileSync(resolve(directory, file), 'utf8')
      for (const match of source.matchAll(pattern)) {
        const relative = at(match, 1).replace(/^(\.\.\/)+/, '')
        const segments = relative.split('/')
        if (relative.startsWith('supabase/')) {
          // One tree, and every parity suite reads migrations from it.
          found.add('supabase')
        } else if (relative.startsWith('src/')) {
          // The directory holding the file, so the trigger is no broader than
          // the dependency: `src/services/supabase`, not all of `src/services`.
          found.add(segments.slice(0, -1).join('/'))
        } else if (relative.startsWith('scripts/')) {
          found.add(segments.slice(0, 2).join('/'))
        } else {
          // `config/` and `fixtures/` are named files, not trees.
          found.add(relative)
        }
      }
    }
  }

  return [...found].sort()
}

describe('database parity trigger covers what the suites consume', () => {
  it('finds the dependencies at all, so the assertion below is not vacuous', () => {
    const consumed = consumedPaths()
    expect(consumed.length).toBeGreaterThanOrEqual(5)
    // The two the literal list omitted. Named explicitly as well as derived,
    // because these are the reason the whole workflow exists.
    expect(consumed).toContain('supabase')
    expect(consumed.some((path) => path.startsWith('src/domain'))).toBe(true)
    // Positive control on the parser: a filter list it cannot read would make
    // every path look uncovered rather than covered.
    expect(declaredFilters().length).toBeGreaterThanOrEqual(10)
  })

  it('runs for a change to anything the parity suites read', () => {
    const uncovered = consumedPaths().filter((path) => !filterCovers(path))

    expect(
      uncovered,
      'The parity suites read these paths, but a change to them would not run ' +
        'the parity workflow — so the suite asserting against them would not ' +
        'be re-run on the pull request that changed them. Add each to the ' +
        '`PARITY_PATHS` list in .github/workflows/database-parity.yml.',
    ).toEqual([])
  })

  it('watches the migrations and the domain logic it exists to compare', () => {
    // The instance the derived rule above generalises. Stated separately so a
    // regression names the two paths rather than a computed list.
    expect(filterCovers('supabase')).toBe(true)
    expect(filterCovers('src/domain')).toBe(true)
    expect(filterCovers('src/domain/season')).toBe(true)
  })
})

describe('database parity workflow trigger contract', () => {
  it('watches the production rollout SQL directory', () => {
    expect(declaredFilters()).toContain('scripts/database-rollout/**')
    expect(declaredFilters()).not.toContain('scripts/database-parity/**')
  })

  it('watches the Stage C1 hosted execution scripts and development workflow', () => {
    expect(declaredFilters()).toContain('scripts/ops/**')
    expect(declaredFilters()).toContain(
      '.github/workflows/stage-c1-development-rollout.yml',
    )
    expect(declaredFilters()).toContain(
      'tests/scripts/stageC1DevelopmentRolloutWorkflow.test.ts',
    )
  })

  it('watches the application/database deployment contract', () => {
    expect(declaredFilters()).toContain('config/deployment-contract.json')
  })

  it('watches this regression test and supports manual verification', () => {
    expect(declaredFilters()).toContain('tests/scripts/databaseParityWorkflow.test.ts')
    expect(workflow).toContain('workflow_dispatch:')
  })

  it('watches the whole parity suite directory', () => {
    expect(declaredFilters()).toContain('tests/database-parity/**')
  })

  it('watches the migration-transition suite directory', () => {
    expect(declaredFilters()).toContain('tests/migration-transition/**')
  })
})

describe('the parity gate can be required without blocking anything', () => {
  const trigger = workflow.slice(workflow.indexOf('on:'), workflow.indexOf('permissions:'))

  it('runs on every pull request rather than only on the paths it measures', () => {
    expect(trigger).toContain('pull_request:')
    // The filter that made this unrequirable. Its absence here is the change.
    expect(trigger).not.toContain('paths:')
  })

  it('asks what this branch changed, not how the two trees differ', () => {
    // `git diff A B` compares trees, so a base branch that has advanced makes
    // its own changes look like this pull request's. Proven: a branch touching
    // only docs.md reports src/domain/logic.ts as changed when the base moved
    // there. `A...B` diffs from the merge base and reports only docs.md.
    expect(workflow).toContain('git diff --name-only "$BASE_SHA...$HEAD_SHA"')
    expect(workflow).not.toMatch(/git diff --name-only "\$BASE_SHA" "\$HEAD_SHA"/)
  })

  it('publishes a stable context named the way a ruleset asks for it', () => {
    expect(workflow).toContain('name: Database parity / Required parity gate')
  })

  it('reports a conclusion whatever the suites did, including not running', () => {
    // `always()` rather than `!cancelled()`: a gate that vanished when a suite
    // failed would be indistinguishable, to a ruleset, from one that passed.
    const gate = workflow.slice(workflow.indexOf('  gate:'))
    expect(gate).toContain('if: ${{ always() }}')
    expect(gate).toContain('needs: [changes, local-supabase, migration-transition]')
  })

  it('fails unless the suites actually succeeded where they were owed', () => {
    // The propagation is the whole point. Without it the gate would be an
    // always-green context, which is worse than no context at all: it would
    // satisfy a merge rule while the evidence was red, cancelled or absent.
    const gate = workflow.slice(workflow.indexOf('  gate:'))
    expect(gate).toContain("needs.changes.outputs.parity == 'true'")
    expect(gate).toContain("needs.local-supabase.result != 'success'")
    expect(gate).toContain("needs.migration-transition.result != 'success'")
    // And an unanswered decision is not "nothing to measure": an empty output
    // is not 'true', so without this the gate would pass a pull request nobody
    // had classified.
    expect(gate).toContain("needs.changes.result != 'success'")
  })

  it('still keeps the expensive suites off unrelated pull requests', () => {
    // Removing the trigger filter must not mean spinning Supabase on every
    // pull request. The decision moved; it did not widen.
    expect(workflow).toContain("if: ${{ needs.changes.outputs.parity == 'true' }}")
    expect(workflow).toContain('needs: changes')
  })
})

describe('database parity workflow provider-poll contract', () => {
  it('starts and rejects the service-only function before database checks', () => {
    const rebuild = workflow.indexOf('supabase db reset --local')
    const unauthorized = workflow.indexOf(
      'Prove provider poll rejects unauthorized requests',
    )
    const lint = workflow.indexOf('supabase db lint --local')

    expect(rebuild).toBeGreaterThan(-1)
    expect(unauthorized).toBeGreaterThan(rebuild)
    expect(lint).toBeGreaterThan(unauthorized)
    expect(workflow).toContain(
      'http://127.0.0.1:54321/functions/v1/provider-poll',
    )
    expect(workflow).toContain("test \"$status\" = '401'")
    expect(workflow).toContain('body.error !== "unauthorized"')
  })

  it('supplies no caller key or provider credential to the rejection probe', () => {
    const stepStart = workflow.indexOf(
      '- name: Prove provider poll rejects unauthorized requests',
    )
    const nextStep = workflow.indexOf('\n      - name:', stepStart + 1)
    const step = workflow.slice(stepStart, nextStep)

    expect(step).not.toContain("--header 'apikey:")
    expect(step).not.toContain('SPORTMONKS_API_TOKEN')
    expect(step).not.toContain('API_FOOTBALL_API_KEY')
    expect(step).not.toContain('FOOTBALL_DATA_API_KEY')
  })
})

describe('database parity workflow migration-transition contract', () => {
  it('rehearses each populated transition from its exact prior contract', () => {
    // Rebuild jobs reach every migration with empty tables, so a backfill whose
    // failure needs a row can only be caught by arriving with data. Each subject
    // therefore runs after a reset to the canonical contract immediately before
    // the migration it owns.
    expect(workflow).toContain('supabase db reset --local --version 20260730180000')
    expect(workflow).toContain(
      'npx vitest run tests/migration-transition/stageC1AuditScopeTransition.test.ts',
    )
    expect(workflow).toContain('supabase db reset --local --version 20260730235602')
    expect(workflow).toContain(
      'npx vitest run tests/migration-transition/c1bGameCatalogueMembershipsTransition.test.ts',
    )

    expect(
      workflow.indexOf('supabase db reset --local --version 20260730180000'),
    ).toBeLessThan(
      workflow.indexOf(
        'npx vitest run tests/migration-transition/stageC1AuditScopeTransition.test.ts',
      ),
    )
    expect(
      workflow.indexOf('supabase db reset --local --version 20260730235602'),
    ).toBeLessThan(
      workflow.indexOf(
        'npx vitest run tests/migration-transition/c1bGameCatalogueMembershipsTransition.test.ts',
      ),
    )
  })

  it('executes every migration-transition subject exactly once', () => {
    const subjects = readdirSync(transitionSuiteDir).filter((file) =>
      /\.test\.tsx?$/.test(file),
    )

    expect(subjects.length).toBeGreaterThan(1)
    for (const subject of subjects) {
      const subjectPath = `tests/migration-transition/${subject}`
      expect(workflow.split(subjectPath)).toHaveLength(2)
    }
  })
})

describe('database parity workflow coverage contract', () => {
  it('runs the whole parity suite rather than a named file', () => {
    // The trigger already fires on `tests/database-parity/**`, so naming one
    // file made the job look like parity coverage while executing a single
    // subject: a new parity test was triggered by, but not run in, this job.
    expect(workflow).toContain('npx vitest run tests/database-parity/')
    expect(workflow).not.toMatch(
      /npx vitest run tests\/database-parity\/\S+\.test\.tsx?/,
    )
  })

  it('executes every parity subject that exists', () => {
    // Directly ties the suite on disk to what the job runs, so this fails if the
    // run command is ever narrowed back to a subset.
    const subjects = readdirSync(paritySuiteDir).filter((file) =>
      /\.test\.tsx?$/.test(file),
    )

    expect(subjects.length).toBeGreaterThan(1)
    for (const subject of subjects) {
      expect(workflow).not.toContain(`tests/database-parity/${subject}`)
    }
  })

  it('supplies the database-backed parity environment', () => {
    // Parity subjects gate their SQL-executing cases on DATABASE_PARITY, so
    // without these the job would silently run only the static comparisons.
    expect(workflow).toContain("DATABASE_PARITY: '1'")
    expect(workflow).toContain(
      'SUPABASE_DB_CONTAINER: supabase_db_euro-2028-predictor-local',
    )
  })
})
