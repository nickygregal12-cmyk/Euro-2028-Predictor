import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/production-health.yml'),
  'utf8',
)
const wrapper = readFileSync(
  resolve(repositoryRoot, 'scripts/production-health.mjs'),
  'utf8',
)

describe('scheduled production health', () => {
  it('runs hourly and remains manually dispatchable', () => {
    expect(workflow).toContain("cron: '17 * * * *'")
    expect(workflow).toContain('workflow_dispatch:')
  })

  it('checks both production products independently', () => {
    expect(workflow).toContain('- euro')
    expect(workflow).toContain('- hub')
    expect(workflow).toContain('production-health-${{ matrix.site }}')
    expect(workflow).toContain('fail-fast: false')
  })

  it('keeps the scheduled job lightweight', () => {
    expect(workflow).not.toContain('npm ci')
    expect(workflow).not.toContain('playwright install')
    expect(workflow).toContain('node scripts/production-health.mjs')
  })

  it('derives the expected contract from the served release, not repository main', () => {
    expect(wrapper).toContain("fetch(`${siteOrigin}/release.json`")
    expect(wrapper).toContain('release.applicationContract')
    expect(wrapper).toContain('EURO28_SMOKE_EXPECTED_CONTRACT: String(servedContract)')
    expect(wrapper).toContain("EURO28_SMOKE_EXPECTED_COMMIT: ''")
  })

  it('delegates the actual assertions to the existing production smoke', () => {
    expect(wrapper).toContain("new URL('./production-smoke.mjs', import.meta.url)")
    expect(wrapper).toContain("EURO28_SMOKE_EXPECTED_CONTEXT: 'production'")
    expect(wrapper).toContain('EURO28_SMOKE_EXPECTED_SUPABASE_REF')
  })

  it('has read-only repository permissions and a bounded runtime', () => {
    expect(workflow).toContain('contents: read')
    expect(workflow).toContain('timeout-minutes: 10')
    expect(workflow).toContain('persist-credentials: false')
  })
})
