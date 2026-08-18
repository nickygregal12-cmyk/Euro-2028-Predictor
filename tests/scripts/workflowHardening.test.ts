import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  findFloatingActionRefs,
  findFloatingAddedActionRefs,
} from '../../scripts/check-workflow-action-pins.mjs'
import { parse } from 'yaml'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const secretBearingWorkflows = [
  'ai-lab.yml',
  'ai-lab-tests.yml',
  'ai-lab-value-catchup.yml',
  'ai-morning-value-catchup.yml',
  'ai-observability-extras.yml',
  'ai-odds-scheduler-reconcile.yml',
  'ai-selected-auto-activate.yml',
  'ai-selected-challenger-materialize.yml',
  'codeql.yml',
  'production-backup.yml',
  'production-smoke.yml',
]
const credentialPersistingWorkflows = new Set([
  'development-hosted-status-followup.yml',
  'graphify-navigation.yml',
  'regenerate-database-types.yml',
  'visual-contracts.yml',
])

describe('workflow supply-chain hardening', () => {
  it('rejects newly added floating action tags while permitting local actions', () => {
    expect(
      findFloatingAddedActionRefs(`diff --git a/x b/x
+      - uses: actions/checkout@v7
+      - uses: ./.github/actions/local
+      - uses: owner/action@0123456789abcdef0123456789abcdef01234567
`),
    ).toEqual([{ line: 2, action: 'actions/checkout@v7' }])
  })

  it('runs the full-repository pin policy in the workflow analyzer', () => {
    const workflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/security-tooling.yml'),
      'utf8',
    )
    expect(workflow).toContain('check-workflow-action-pins.mjs')
  })

  it('has retired the floating-action baseline across every workflow', () => {
    const files = execFileSync(
      'git',
      ['ls-files', '.github/workflows/*.yml', '.github/workflows/*.yaml'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
    const findings = files.flatMap((file) =>
      findFloatingActionRefs(
        readFileSync(resolve(repositoryRoot, file), 'utf8'),
        file,
      ),
    )

    expect(findings).toEqual([])
  })

  it.each(secretBearingWorkflows)('%s is hardened and fully pinned', (name) => {
    const workflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows', name),
      'utf8',
    )
    expect(workflow).toMatch(/step-security\/harden-runner@[0-9a-f]{40}/)
    for (const action of workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
      expect(action[1]).toMatch(/^[0-9a-f]{40}$/)
    }
  })

  it('disables checkout credential persistence except in the four push jobs', () => {
    const files = execFileSync(
      'git',
      ['ls-files', '.github/workflows/*.yml', '.github/workflows/*.yaml'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)

    for (const file of files) {
      const workflow = parse(
        readFileSync(resolve(repositoryRoot, file), 'utf8'),
      ) as {
        jobs?: Record<
          string,
          { steps?: Array<{ uses?: string; with?: Record<string, unknown> }> }
        >
      }
      for (const job of Object.values(workflow.jobs ?? {})) {
        for (const step of job.steps ?? []) {
          if (!step.uses?.startsWith('actions/checkout@')) continue
          const name = file.split('/').at(-1) ?? file
          if (credentialPersistingWorkflows.has(name)) {
            expect(step.with?.['persist-credentials']).not.toBe(false)
          } else {
            expect(step.with?.['persist-credentials'], file).toBe(false)
          }
        }
      }
    }
  })

  it('makes the zero-finding Zizmor audit blocking', () => {
    const workflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/security-tooling.yml'),
      'utf8',
    )
    const config = readFileSync(
      resolve(repositoryRoot, '.github/zizmor.yml'),
      'utf8',
    )

    expect(workflow).toMatch(/zizmorcore\/zizmor-action@[0-9a-f]{40}/)
    expect(workflow).not.toMatch(/zizmor:[\s\S]*?continue-on-error:\s*true/)
    expect(config).toContain('rules:')
    expect(config).not.toMatch(/^\s*unpinned-uses:\s*false\s*$/m)
  })

  it('keeps ShellCheck active inside Actionlint', () => {
    const workflow = readFileSync(
      resolve(repositoryRoot, '.github/workflows/security-tooling.yml'),
      'utf8',
    )

    expect(workflow).not.toContain("-shellcheck=''")
    expect(workflow).toMatch(/actionlint -color/)
    expect(workflow).not.toContain('actionlint -color || true')
  })
})
