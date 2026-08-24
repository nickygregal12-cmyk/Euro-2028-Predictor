import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('release verifier hosted identities', () => {
  it('pins the two live Netlify site IDs and keeps the retired development site separate', () => {
    const sites = JSON.parse(read('config/netlify-sites.json')) as {
      production: {
        hub: { name: string; siteId: string; variant: string }
        euro: { name: string; siteId: string; variant: string }
      }
      retired: {
        euroDevelopment: { name: string; siteId: string }
      }
    }

    expect(sites.production.hub).toEqual(expect.objectContaining({
      name: 'predictorhub',
      siteId: '88356cfb-6815-44ed-9ff6-83100425fac4',
      variant: 'hub',
    }))
    expect(sites.production.euro).toEqual(expect.objectContaining({
      name: 'euro28predictor',
      siteId: 'c69da01a-4650-43db-a1d2-b78b7f8e198a',
      variant: 'euro',
    }))
    expect(sites.retired.euroDevelopment.name).toBe('euro28-predictor-dev')
    expect(new Set([
      sites.production.hub.siteId,
      sites.production.euro.siteId,
      sites.retired.euroDevelopment.siteId,
    ]).size).toBe(3)
  })

  it('keeps Production MCP identity aligned with the canonical hosted record', () => {
    const opencode = JSON.parse(read('opencode.json')) as {
      mcp: { 'supabase-prod': { url: string } }
    }
    const production = JSON.parse(read('config/production-hosted-contract.json')) as {
      projectRef: string
      requiredMigrationCount: number
      latestMigrationVersion: string
      latestMigrationName: string
    }
    const verifier = read('.opencode/agents/predictor-release-verifier.md')

    expect(production.projectRef).toBe('vkfnsqdyhvtwyqkisxhk')
    expect(production.requiredMigrationCount).toBe(218)
    expect(production.latestMigrationVersion).toBe('20260824100000')
    expect(production.latestMigrationName).toBe('live_results_channel')
    expect(opencode.mcp['supabase-prod'].url).toContain(`project_ref=${production.projectRef}`)
    expect(opencode.mcp['supabase-prod'].url).toContain('read_only=true')
    expect(verifier).toContain('config/production-hosted-contract.json')
    expect(verifier).toContain('fresh read-only migration fingerprint')
  })

  it('requires Netlify reads to start from the canonical site registry', () => {
    const verifier = read('.opencode/agents/predictor-release-verifier.md')
    expect(verifier).toContain('config/netlify-sites.json')
    expect(verifier).toContain('exact `siteId`')
    expect(verifier).toContain('deploy ID is live external truth')
    expect(verifier).toContain('retired `euro28-predictor-dev`')
  })
})
