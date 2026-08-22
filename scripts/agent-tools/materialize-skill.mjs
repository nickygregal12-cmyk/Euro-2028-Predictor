#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const registryPath = resolve(root, 'config/agent-skill-sources.json')
const allowedLicenses = new Set(['MIT', 'Apache-2.0', 'CC-BY-SA-4.0'])

function fail(message) {
  console.error(`agent:skill: ${message}`)
  process.exit(1)
}

function usage() {
  console.log(`Usage:
  npm run agent:skill -- list
  npm run agent:skill -- check
  npm run agent:skill -- SOURCE_ID [--force] [--json]

Materializes exactly one immutable upstream skill into ignored local cache. The
cache is reference material, never repository/product/hosted authority.`)
}

function readRegistry() {
  if (!existsSync(registryPath)) fail('config/agent-skill-sources.json is missing')
  try {
    return JSON.parse(readFileSync(registryPath, 'utf8'))
  } catch (error) {
    fail(`cannot parse source registry: ${error.message}`)
  }
}

function validateRegistry(registry) {
  const errors = []
  if (typeof registry.cacheRoot !== 'string' || !registry.cacheRoot.startsWith('.agent-cache/')) {
    errors.push('cacheRoot must live under .agent-cache/')
  }
  if (!registry.sources || typeof registry.sources !== 'object') errors.push('sources map is missing')

  for (const [id, source] of Object.entries(registry.sources ?? {})) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) errors.push(`${id}: invalid source id`)
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository ?? '')) {
      errors.push(`${id}: repository must be owner/name`)
    }
    if (!/^[0-9a-f]{40}$/.test(source.commit ?? '')) errors.push(`${id}: commit must be a full 40-hex SHA`)
    if (typeof source.path !== 'string' || source.path.startsWith('/') || source.path.includes('..')) {
      errors.push(`${id}: path must be a safe repository-relative path`)
    }
    if (typeof source.entrypoint !== 'string' || source.entrypoint.startsWith('/') || source.entrypoint.includes('..')) {
      errors.push(`${id}: entrypoint must be a safe relative path`)
    }
    if (!allowedLicenses.has(source.license)) errors.push(`${id}: unsupported/undeclared license ${source.license}`)
    if (!['routed', 'conditional-review', 'catalogue-only'].includes(source.mode)) {
      errors.push(`${id}: invalid mode ${source.mode}`)
    }
    if (source.mode !== 'catalogue-only' && !source.adapter) errors.push(`${id}: routed source needs an adapter`)
  }
  return errors
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || 'command failed').trim()
    fail(`${command} ${args.join(' ')} failed: ${detail}`)
  }
  return (result.stdout ?? '').trim()
}

const registry = readRegistry()
const validationErrors = validateRegistry(registry)
const args = process.argv.slice(2)
const command = args[0]

if (!command || command === '-h' || command === '--help') {
  usage()
  process.exit(command ? 0 : 2)
}

if (command === 'check') {
  if (validationErrors.length) fail(validationErrors.join('; '))
  console.log(`Validated ${Object.keys(registry.sources).length} pinned specialist skill sources.`)
  process.exit(0)
}

if (validationErrors.length) fail(validationErrors.join('; '))

if (command === 'list') {
  for (const [id, source] of Object.entries(registry.sources)) {
    console.log(`${id}\t${source.mode}\t${source.license}\t${source.repository}@${source.commit.slice(0, 12)}`)
  }
  process.exit(0)
}

const source = registry.sources[command]
if (!source) fail(`unknown source '${command}'; run 'npm run agent:skill -- list'`)

let force = false
let jsonOutput = false
for (const arg of args.slice(1)) {
  if (arg === '--force') force = true
  else if (arg === '--json') jsonOutput = true
  else fail(`unknown option '${arg}'`)
}

const cacheRoot = resolve(root, registry.cacheRoot)
const destination = resolve(cacheRoot, command, source.commit)
const entrypoint = resolve(destination, source.entrypoint)
const stampPath = resolve(destination, '.source.json')

if (!force && existsSync(entrypoint) && existsSync(stampPath)) {
  const stamp = JSON.parse(readFileSync(stampPath, 'utf8'))
  if (stamp.repository === source.repository && stamp.commit === source.commit && stamp.path === source.path) {
    const packet = { id: command, cached: true, entrypoint, license: source.license, commit: source.commit }
    console.log(jsonOutput ? JSON.stringify(packet, null, 2) : entrypoint)
    process.exit(0)
  }
}

const temporary = mkdtempSync(resolve(tmpdir(), 'predictor-agent-skill-'))
const checkout = resolve(temporary, 'checkout')
mkdirSync(checkout)

try {
  run('git', ['init', '--quiet'], checkout)
  run('git', ['remote', 'add', 'origin', `https://github.com/${source.repository}.git`], checkout)
  run('git', ['-c', 'protocol.version=2', 'fetch', '--quiet', '--depth=1', '--filter=blob:none', 'origin', source.commit], checkout)
  const fetched = run('git', ['rev-parse', 'FETCH_HEAD'], checkout)
  if (fetched !== source.commit) fail(`${command}: fetched ${fetched}, expected ${source.commit}`)
  run('git', ['checkout', '--quiet', 'FETCH_HEAD', '--', source.path], checkout)

  const upstreamPath = resolve(checkout, source.path)
  if (!existsSync(resolve(upstreamPath, source.entrypoint))) {
    fail(`${command}: upstream entrypoint ${source.entrypoint} is missing at pinned commit`)
  }

  rmSync(destination, { recursive: true, force: true })
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(upstreamPath, destination, { recursive: true })
  writeFileSync(
    stampPath,
    `${JSON.stringify({
      id: command,
      repository: source.repository,
      commit: source.commit,
      path: source.path,
      entrypoint: source.entrypoint,
      license: source.license,
    }, null, 2)}\n`,
  )
} finally {
  rmSync(temporary, { recursive: true, force: true })
}

const packet = { id: command, cached: false, entrypoint, license: source.license, commit: source.commit }
console.log(jsonOutput ? JSON.stringify(packet, null, 2) : entrypoint)
