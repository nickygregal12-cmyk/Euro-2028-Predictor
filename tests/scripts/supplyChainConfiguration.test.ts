import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('supply-chain evidence configuration', () => {
  it('keeps OpenSSF Scorecard scheduled, pinned and non-publishing', () => {
    const workflow = read('.github/workflows/scorecard.yml')

    expect(workflow).toContain('schedule:')
    expect(workflow).toContain('push:')
    expect(workflow).not.toContain('pull_request:')
    expect(workflow).toContain(
      'ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc # v2.4.4',
    )
    expect(workflow).toContain('publish_results: false')
    expect(workflow).not.toContain('id-token: write')
    expect(workflow).toContain('security-events: write')
    expect(workflow).toContain(
      'github/codeql-action/upload-sarif@ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd # v4.37.7',
    )
  })

  it('generates an install-free lockfile SBOM and retains evidence', () => {
    const workflow = read('.github/workflows/sbom.yml')
    const manifest = JSON.parse(read('package.json')) as { scripts?: Record<string, string> }

    expect(manifest.scripts?.['report:sbom']).toBe(
      'npm sbom --package-lock-only --sbom-format=cyclonedx --sbom-type=application',
    )
    expect(workflow).toContain('npm run --silent report:sbom')
    expect(workflow).not.toContain('npm ci')
    expect(workflow).toContain("sbom.bomFormat !== 'CycloneDX'")
    expect(workflow).toContain('sha256sum .artifacts/supply-chain/sbom.cdx.json')
    expect(workflow).toContain('retention-days: 30')
  })

  it('keeps both additions inside the already-approved open-source boundary', () => {
    const register = read('docs/quality/open-source-improvements/source-register.md')

    expect(register).toContain('| OpenSSF Scorecard |')
    expect(register).toContain('| npm SBOM |')
  })
})
