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

async function canonicalSite(site) {
  if (typeof site !== 'string' || !allowedSites.has(site)) {
    throw new Error('site must be one of: hub, euro')
  }
  const registry = JSON.parse(await readFile(sitesPath, 'utf8'))
  const record = registry.production?.[site]
  if (!record || typeof record.name !== 'string' || typeof record.siteId !== 'string') {
    throw new Error('canonical production site registry is invalid')
  }
  return record
}

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

function boundedString(value, field, maxLength = 256) {
  if (value == null) return null
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`Netlify response contained an invalid ${field}`)
  }
  return value
}

export async function fetchCurrentProductionDeploy(site, fetchImpl = globalThis.fetch) {
  const canonical = await canonicalSite(site)
  const url = `${NETLIFY_API_ORIGIN}/api/v1/sites/${encodeURIComponent(canonical.siteId)}/deploys?per_page=1`
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Netlify current deploy read failed with HTTP ${response.status}`)
  const payload = JSON.parse(await boundedResponseText(response))
  const deploy = Array.isArray(payload) ? payload[0] : undefined
  if (!deploy || typeof deploy !== 'object') throw new Error('Netlify returned no current deploy')
  if (deploy.site_id != null && deploy.site_id !== canonical.siteId) {
    throw new Error('Netlify response site did not match canonical identity')
  }

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

const errorResponse = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })

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
