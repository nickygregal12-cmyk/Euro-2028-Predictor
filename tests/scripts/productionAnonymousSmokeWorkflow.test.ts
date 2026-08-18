import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  resolve(
    import.meta.dirname,
    '../../.github/workflows/production-anonymous-smoke.yml',
  ),
  'utf8',
)

describe('scheduled anonymous production smoke', () => {
  it('runs on a schedule and remains manually reproducible', () => {
    expect(workflow).toMatch(/schedule:\s*\n\s*- cron:/)
    expect(workflow).toContain('workflow_dispatch:')
  })

  it('checks both published origins without credentials', () => {
    expect(workflow).toContain('https://euro28predictor.com')
    expect(workflow).toContain('https://predictorhub.netlify.app')
    expect(workflow).not.toContain('secrets.')
    expect(workflow).not.toContain('PRODUCTION_SITE_PASSWORD')
  })

  it('proves the protected perimeter without mutating or logging in', () => {
    expect(workflow).toContain("expected='401'")
    expect(workflow).toContain('/release.json')
    expect(workflow).not.toMatch(/npm ci|playwright|storage-state|\/auth\/v1/)
  })

  it('uses bounded permissions and pinned runner hardening', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/)
    expect(workflow).toMatch(
      /step-security\/harden-runner@[0-9a-f]{40}/,
    )
  })
})
