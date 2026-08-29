#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline'

export const NETLIFY_API_ORIGIN = 'https://api.netlify.com'
export const TOOL_NAME = 'current-production-deploy'
const MAX_RESPONSE_BYTES = 64 * 1024
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sitesPath = resolve(repositoryRoot, 'config/netlify-sites.json')
const allowedSites = new Set(['hub', 'euro'])
const canonicalSiteIds = Object.freeze({
  hub: '88356cfb-6815-44ed-9ff6-83100425fac4',
  euro: 'c69da01a-4650-43db-a1d2-b78b7f8e198a',
})

/** @param {unknown} site */
function canonicalSiteId(site) {
  if (typeof site !== 'string' || !allowedSites.has(site)) {
    throw new Error('site must be one of: hub, euro')
  }
  return site === 'hub' ? canonicalSiteIds.hub : canonicalSiteIds.euro
}

/**
 * @param {unknown} site
 * @param {string} expectedSiteId
 * @returns {Promise<{ name: string, siteId: string }>}
 */
async function canonicalSite(site, expectedSiteId) {
  if (site !== 'hub' && site !== 'euro') throw new Error('site must be one of: hub, euro')
  const registry = JSON.parse(await readFile(sitesPath, 'utf8'))
  const record = registry.production?.[site]
  if (!record || typeof record.name !== 'string' || record.siteId !== expectedSiteId) {
    throw new Error('canonical production site registry is invalid')
  }
  return { name: record.name, siteId: expectedSiteId }
}

/** @param {Response} response */
async function boundedResponseText(response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('Netlify response exceeded 64 KiB')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} [maxLength]
 */
function boundedString(value, field, maxLength = 256) {
  if (value == null) return null
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`Netlify response contained an invalid ${field}`)
  }
  return value
}

/** @param {unknown} value */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @param {string} siteId
 */
function isCurrentProductionDeploy(value, siteId) {
  if (!isRecord(value)) return false
  const deploy = /** @type {Record<string, unknown>} */ (value)
  return deploy.site_id === siteId &&
    deploy.context === 'production' &&
    deploy.branch === 'main' &&
    deploy.state === 'ready' &&
    typeof deploy.published_at === 'string' &&
    deploy.published_at.trim().length > 0
}

/**
 * @param {unknown} site
 * @param {typeof globalThis.fetch} [fetchImpl]
 */
export async function fetchCurrentProductionDeploy(site, fetchImpl = globalThis.fetch) {
  // The network destination is built only from this reviewed, non-secret
  // constant. The repository file is checked for parity below, but no file data
  // flows into the outbound request.
  const expectedSiteId = canonicalSiteId(site)
  const canonical = await canonicalSite(site, expectedSiteId)
  const url = new URL(`/api/v1/sites/${expectedSiteId}/deploys`, NETLIFY_API_ORIGIN)
  url.searchParams.set('production', 'true')
  url.searchParams.set('per_page', '20')
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Netlify current deploy read failed with HTTP ${response.status}`)
  const payload = /** @type {unknown} */ (JSON.parse(await boundedResponseText(response)))
  const selected = Array.isArray(payload)
    ? payload.find((candidate) => isCurrentProductionDeploy(candidate, expectedSiteId))
    : undefined
  if (!isRecord(selected)) {
    throw new Error('Netlify returned no canonical ready published Production deploy')
  }
  const deploy = /** @type {Record<string, unknown>} */ (selected)

  const result = {
    siteName: canonical.name,
    siteId: canonical.siteId,
    deployId: boundedString(deploy.id, 'deploy id'),
    state: boundedString(deploy.state, 'state', 64),
    commitSha: boundedString(deploy.commit_ref, 'commit SHA'),
    createdAt: boundedString(deploy.created_at, 'created timestamp'),
    updatedAt: boundedString(deploy.updated_at, 'updated timestamp'),
    publishedAt: boundedString(deploy.published_at, 'published timestamp'),
  }
  if (!result.deployId || !result.state) throw new Error('Netlify response omitted deploy identity or state')
  return result
}

const tool = {
  name: TOOL_NAME,
  title: 'Read current canonical Production deploy',
  description: 'GET the latest public deploy metadata for a canonical Production site.',
  inputSchema: {
    type: 'object',
    properties: { site: { type: 'string', enum: ['hub', 'euro'] } },
    required: ['site'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
}

/**
 * @param {unknown} id
 * @param {number} code
 * @param {string} message
 */
const errorResponse = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })

/** @param {Record<string, any>} request */
export async function handleRequest(request) {
  const id = request?.id ?? null
  switch (request?.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'predictor-netlify-public-deploy', version: '1.0.0' },
        },
      }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} }
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: [tool] } }
    case 'tools/call': {
      if (request.params?.name !== TOOL_NAME) return errorResponse(id, -32601, 'Unknown tool')
      try {
        const args = request.params?.arguments
        if (!args || typeof args !== 'object' || Array.isArray(args) ||
            Object.keys(args).length !== 1 || !Object.hasOwn(args, 'site')) {
          throw new Error('arguments must contain only the canonical site selector')
        }
        const deploy = await fetchCurrentProductionDeploy(args.site)
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: JSON.stringify(deploy) }], structuredContent: deploy },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Netlify current deploy read failed'
        return { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: message }] } }
      }
    }
    default:
      return errorResponse(id, -32601, 'Method not found')
  }
}

async function serve() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
  for await (const line of lines) {
    if (!line.trim()) continue
    let request
    try {
      request = JSON.parse(line)
    } catch {
      process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, 'Parse error'))}\n`)
      continue
    }
    if (request.method === 'notifications/initialized' || request.id === undefined) continue
    process.stdout.write(`${JSON.stringify(await handleRequest(request))}\n`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  serve().catch((error) => {
    process.stderr.write(`Netlify public deploy MCP failed: ${error instanceof Error ? error.message : 'unknown error'}\n`)
    process.exitCode = 1
  })
}
