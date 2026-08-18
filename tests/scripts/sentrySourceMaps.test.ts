import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const viteConfig = readFileSync(resolve(repositoryRoot, 'vite.config.ts'), 'utf8')
const operations = readFileSync(resolve(repositoryRoot, 'docs/ops-sentry.md'), 'utf8')
const manifest = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
) as { devDependencies: Record<string, string> }

describe('trusted Sentry source-map builds', () => {
  it('pins the official Vite upload plugin as build tooling', () => {
    expect(manifest.devDependencies['@sentry/vite-plugin']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(viteConfig).toContain("from '@sentry/vite-plugin'")
  })

  it('requires an explicit switch and every upload credential', () => {
    expect(viteConfig).toContain("SENTRY_SOURCEMAPS_ENABLED') === 'true'")
    for (const name of ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']) {
      expect(viteConfig).toContain(`'${name}'`)
    }
    expect(viteConfig).toMatch(/command === 'build'/)
  })

  it('uses the same exact release identity as the browser SDK', () => {
    expect(viteConfig).toContain('euro28@${releaseMetadata.commit}')
  })

  it('does not publish source maps with the deployed site', () => {
    expect(viteConfig).toMatch(/sourcemap:\s*sentrySourceMapsEnabled\s*\?\s*'hidden'\s*:\s*false/)
    expect(viteConfig).toContain('filesToDeleteAfterUpload')
    expect(viteConfig).toContain("'./dist/**/*.map'")
  })

  it('documents build-only custody and the disabled-by-default path', () => {
    expect(operations).toContain('SENTRY_SOURCEMAPS_ENABLED=true')
    expect(operations).toContain('SENTRY_AUTH_TOKEN')
    expect(operations).toMatch(
      /ordinary builds do not generate or upload\s+source maps/,
    )
  })
})
