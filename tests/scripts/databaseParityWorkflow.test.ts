import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflowPath = resolve(repositoryRoot, '.github/workflows/database-parity.yml')
const workflow = readFileSync(workflowPath, 'utf8')

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
})
