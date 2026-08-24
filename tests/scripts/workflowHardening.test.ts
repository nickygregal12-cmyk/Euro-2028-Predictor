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
/**
 * The jobs allowed to keep a push credential on disk, named as `file#job`.
 *
 * WIDENED FROM A LIST OF FILES, and widened rather than relaxed. The old form
 * said "every checkout in these workflows may persist", which was right while a
 * pushing workflow was pushing-only. `journey-probe.yml` is the first with two
 * jobs that must DIFFER: the job that touches the network holds no credential,
 * and the job that holds the credential touches no network. Per-file, that
 * workflow could only be described by permitting its network job a token too —
 * the guard would have forced the removal of the very boundary it exists to
 * protect.
 *
 * Naming the job is strictly stricter: every entry below was previously implied
 * for a whole file and is now spelled out for one job in it.
 */
const credentialPersistingJobs = new Set([
  'development-hosted-status-followup.yml#record-hosted-contract',
  'graphify-navigation.yml#build-navigation-graph',
  'regenerate-database-types.yml#regenerate',
  'visual-contracts.yml#visual',
  // Holds contents:write and makes no network request of its own; the walking
  // job beside it holds neither.
  'journey-probe.yml#publish',
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

  it('disables checkout credential persistence except in the named push jobs', () => {
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
      for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
        for (const step of job.steps ?? []) {
          if (!step.uses?.startsWith('actions/checkout@')) continue
          const name = file.split('/').at(-1) ?? file
          const key = `${name}#${jobName}`
          if (credentialPersistingJobs.has(key)) {
            expect(step.with?.['persist-credentials'], key).not.toBe(false)
          } else {
            expect(step.with?.['persist-credentials'], key).toBe(false)
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

  it('keeps Dependabot on cooled-down action pins without npm overlap', () => {
    const dependabot = parse(
      readFileSync(resolve(repositoryRoot, '.github/dependabot.yml'), 'utf8'),
    ) as {
      updates?: Array<{
        'package-ecosystem'?: string
        cooldown?: { 'default-days'?: number }
      }>
    }

    expect(
      dependabot.updates?.map((update) => update['package-ecosystem']),
    ).toEqual(['github-actions'])
    for (const update of dependabot.updates ?? []) {
      expect(
        update.cooldown?.['default-days'],
        update['package-ecosystem'],
      ).toBeGreaterThanOrEqual(7)
    }
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
