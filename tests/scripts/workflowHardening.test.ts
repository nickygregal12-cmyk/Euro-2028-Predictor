import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  findFloatingActionRefs,
  findFloatingAddedActionRefs,
  findUnlabelledActionPins,
} from '../../scripts/check-workflow-action-pins.mjs'

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

  it('requires a pinned action to name the version it pins', () => {
    // A pin without a version comment is not a lesser finding of the same
    // kind -- it is the one that hides the others. `zizmor` proved this on
    // `codeql.yml`, where `@988661eb... # v4` was a full SHA, passed the pin
    // check, and pointed at a DIFFERENT commit than `v4` resolves to. Only the
    // comment made the mismatch visible. Resolving the tag needs the network;
    // requiring the claim to exist does not.
    expect(
      findUnlabelledActionPins(
        [
          '      - uses: owner/action@0123456789abcdef0123456789abcdef01234567',
          '      - uses: owner/other@0123456789abcdef0123456789abcdef01234567 # v3.1.0',
          '      - uses: ./.github/actions/local',
          '      - uses: owner/floating@v4',
        ].join('\n'),
        'sample.yml',
      ),
    ).toEqual([
      {
        file: 'sample.yml',
        line: 1,
        action: 'owner/action@0123456789abcdef0123456789abcdef01234567',
      },
    ])
  })

  it('has no unlabelled pin left in any workflow', () => {
    const files = execFileSync(
      'git',
      ['ls-files', '.github/workflows/*.yml', '.github/workflows/*.yaml'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
    const findings = files.flatMap((file) =>
      findUnlabelledActionPins(
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
})
