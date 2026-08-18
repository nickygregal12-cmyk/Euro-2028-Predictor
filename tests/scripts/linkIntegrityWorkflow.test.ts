import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/link-integrity.yml'),
  'utf8',
)

describe('documentation link integrity workflow', () => {
  it('runs for documentation changes, on schedule and on demand', () => {
    expect(workflow).toContain('pull_request:')
    expect(workflow).toMatch(/schedule:\s*\n\s*- cron:/)
    expect(workflow).toContain('workflow_dispatch:')
  })

  it('installs one checksum-verified Lychee release', () => {
    expect(workflow).toContain('lychee-v0.24.2')
    expect(workflow).toContain(
      '1f4e0ef7f6554a6ed33dd7ac144fb2e1bbed98598e7af973042fc5cd43951c9a',
    )
    expect(workflow).toContain('sha256sum --check --strict')
  })

  it('checks tracked Markdown links and anchors without external disclosure', () => {
    expect(workflow).toContain("git ls-files '*.md'")
    expect(workflow).toContain('--include-fragments=anchor-only')
    expect(workflow).toContain('--offline')
    expect(workflow).not.toContain('GITHUB_TOKEN')
  })

  it('uses pinned actions and bounded permissions', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/)
    for (const action of workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
      expect(action[1]).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})
