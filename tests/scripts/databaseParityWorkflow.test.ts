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

describe('database parity workflow migration-transition contract', () => {
  it('rehearses a transition from a prior contract, not from a rebuild', () => {
    // Rebuild jobs reach every migration with empty tables, so a statement whose
    // failure needs a row can only be caught by arriving at it with data. The
    // reset must therefore stop at the prior canonical version.
    expect(workflow).toContain('supabase db reset --local --version 20260730180000')
    expect(workflow).toContain('npx vitest run tests/migration-transition/')
  })

  it('executes every migration-transition subject that exists', () => {
    const subjects = readdirSync(transitionSuiteDir).filter((file) =>
      /\.test\.tsx?$/.test(file),
    )

    expect(subjects.length).toBeGreaterThan(0)
    for (const subject of subjects) {
      expect(workflow).not.toContain(`tests/migration-transition/${subject}`)
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
