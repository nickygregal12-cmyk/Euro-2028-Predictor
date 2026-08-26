import { spawnSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import {
  handleRequest,
  fetchCurrentProductionDeploy,
  NETLIFY_API_ORIGIN,
  TOOL_NAME,
} from '../../scripts/agent-tools/netlify-public-deploy-mcp.mjs'

describe('public Netlify current-deploy MCP adapter', () => {
  it('serves MCP initialize and tools/list over newline-delimited stdio', () => {
    const result = spawnSync('node', ['scripts/agent-tools/netlify-public-deploy-mcp.mjs'], {
      cwd: process.cwd(),
      input: [
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
        JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
        JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
        '',
      ].join('\n'),
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    const messages = result.stdout.trim().split('\n').map((line) => JSON.parse(line))
    expect(messages).toHaveLength(2)
    expect(messages[0].result.serverInfo.name).toBe('predictor-netlify-public-deploy')
    expect(messages[1].result.tools.map((entry: { name: string }) => entry.name)).toEqual([TOOL_NAME])
  })

  it('exposes exactly one read-only tool with canonical production choices', async () => {
    const response = await handleRequest(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    ) as { result: { tools: unknown[] } }
    expect(response.result.tools).toEqual([
      expect.objectContaining({
        name: TOOL_NAME,
        annotations: expect.objectContaining({ readOnlyHint: true }),
        inputSchema: expect.objectContaining({
          additionalProperties: false,
          properties: { site: { type: 'string', enum: ['hub', 'euro'] } },
        }),
      }),
    ])
  })

  it('performs one fixed-host GET and returns only bounded non-secret fields', async () => {
    const fetch = vi.fn(async (_url: Parameters<typeof globalThis.fetch>[0], _init?: RequestInit) => new Response(JSON.stringify([{
      id: 'deploy-123',
      site_id: '88356cfb-6815-44ed-9ff6-83100425fac4',
      state: 'ready',
      commit_ref: 'abc123',
      created_at: '2026-08-26T10:00:00Z',
      updated_at: '2026-08-26T10:01:00Z',
      published_at: '2026-08-26T10:01:00Z',
      env: { SECRET: 'must-not-return' },
      deploy_ssl_url: 'https://example.invalid',
    }])))

    const result = await fetchCurrentProductionDeploy('hub', fetch)

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]!
    expect(new URL(url as string).origin).toBe(NETLIFY_API_ORIGIN)
    expect(url).toBe(
      `${NETLIFY_API_ORIGIN}/api/v1/sites/88356cfb-6815-44ed-9ff6-83100425fac4/deploys?per_page=1`,
    )
    expect(init).toEqual(expect.objectContaining({ method: 'GET', redirect: 'error' }))
    expect(result).toEqual({
      siteName: 'predictorhub',
      siteId: '88356cfb-6815-44ed-9ff6-83100425fac4',
      deployId: 'deploy-123',
      state: 'ready',
      commitSha: 'abc123',
      createdAt: '2026-08-26T10:00:00Z',
      updatedAt: '2026-08-26T10:01:00Z',
      publishedAt: '2026-08-26T10:01:00Z',
    })
    expect(JSON.stringify(result)).not.toContain('SECRET')
    expect(JSON.stringify(result)).not.toContain('deploy_ssl_url')
  })

  it('rejects arbitrary site identities and actions before any network call', async () => {
    const fetch = vi.fn()
    await expect(fetchCurrentProductionDeploy('retired', fetch)).rejects.toThrow(
      'site must be one of: hub, euro',
    )
    expect(fetch).not.toHaveBeenCalled()

    const response = await handleRequest({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'deploy-site', arguments: { site: 'hub' } },
    }) as { error: { code: number } }
    expect(response.error.code).toBe(-32601)

    const arbitraryHost = await handleRequest({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: {
        name: TOOL_NAME,
        arguments: { site: 'hub', host: 'https://example.invalid' },
      },
    }) as { result: { isError: boolean; content: Array<{ text: string }> } }
    expect(arbitraryHost.result.isError).toBe(true)
    expect(arbitraryHost.result.content[0]?.text).toContain('only the canonical site selector')
  })

  it('rejects oversized or cross-site provider responses', async () => {
    const oversized = vi.fn(async (_url: Parameters<typeof globalThis.fetch>[0], _init?: RequestInit) =>
      new Response('x'.repeat(70_000)))
    await expect(fetchCurrentProductionDeploy('hub', oversized)).rejects.toThrow('response exceeded')

    const wrongSite = vi.fn(async (_url: Parameters<typeof globalThis.fetch>[0], _init?: RequestInit) => new Response(JSON.stringify([{
      id: 'deploy-123', site_id: 'not-the-canonical-site', state: 'ready',
    }])))
    await expect(fetchCurrentProductionDeploy('hub', wrongSite)).rejects.toThrow(
      'response site did not match canonical identity',
    )
  })
})
