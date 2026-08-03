import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflowPath = resolve(repositoryRoot, '.github/workflows/database-parity.yml')
const workflow = readFileSync(workflowPath, 'utf8')
const paritySuiteDir = resolve(repositoryRoot, 'tests/database-parity')
const transitionSuiteDir = resolve(repositoryRoot, 'tests/migration-transition')

describe('database parity workflow trigger contract', () => {
  it('watches the production rollout SQL directory', () => {
    expect(workflow).toContain("- 'scripts/database-rollout/**'")
    expect(workflow).not.toContain("- 'scripts/database-parity/**'")
  })

  it('watches the Stage C1 hosted execution scripts and development workflow', () => {
    expect(workflow).toContain("- 'scripts/ops/**'")
    expect(workflow).toContain(
      "- '.github/workflows/stage-c1-development-rollout.yml'",
    )
    expect(workflow).toContain(
      "- 'tests/scripts/stageC1DevelopmentRolloutWorkflow.test.ts'",
    )
  })

  it('watches the application/database deployment contract', () => {
    expect(workflow).toContain("- 'config/deployment-contract.json'")
  })

  it('watches this regression test and supports manual verification', () => {
    expect(workflow).toContain("- 'tests/scripts/databaseParityWorkflow.test.ts'")
    expect(workflow).toContain('workflow_dispatch:')
  })

  it('watches the whole parity suite directory', () => {
    expect(workflow).toContain("- 'tests/database-parity/**'")
  })

  it('watches the migration-transition suite directory', () => {
    expect(workflow).toContain("- 'tests/migration-transition/**'")
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
