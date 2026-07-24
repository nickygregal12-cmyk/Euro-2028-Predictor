import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const expectedNodeVersion = '22.22.2'

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('Node runtime pin', () => {
  it('keeps local, package, CI and Netlify versions aligned', () => {
    const nvmVersion = readRepositoryFile('.nvmrc').trim()
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      engines?: { node?: string }
    }
    const ciWorkflow = readRepositoryFile('.github/workflows/ci.yml')
    const netlifyConfig = readRepositoryFile('netlify.toml')

    expect(nvmVersion).toBe(expectedNodeVersion)
    expect(packageJson.engines?.node).toBe(expectedNodeVersion)
    expect(ciWorkflow).toContain(`node-version: ${expectedNodeVersion}`)
    expect(netlifyConfig).toMatch(
      new RegExp(`NODE_VERSION\\s*=\\s*["']${expectedNodeVersion.replaceAll('.', '\\.') }["']`),
    )
  })
})
