#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const GRAPHIFY_INPUT_ROOTS = [
  'src/',
  'ai/',
  'supabase/',
  'scripts/',
  'tests/',
  'e2e/',
  'config/',
]

const GRAPHIFY_INPUT_FILES = new Set([
  'package.json',
  'package-lock.json',
  '.graphifyignore',
  '.gitignore',
  '.github/workflows/graphify-navigation.yml',
])

function isGraphifyInput(path) {
  return (
    GRAPHIFY_INPUT_FILES.has(path) ||
    /^tsconfig[^/]*\.json$/.test(path) ||
    GRAPHIFY_INPUT_ROOTS.some((root) => path.startsWith(root))
  )
}

function usage() {
  console.error('Usage: node scripts/agent-tools/graphify-input-fingerprint.mjs [--ref GIT_REF]')
}

let ref = 'HEAD'
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index]
  if (arg === '--ref') {
    const value = process.argv[index + 1]
    if (!value) {
      usage()
      process.exit(2)
    }
    ref = value
    index += 1
    continue
  }
  if (arg === '-h' || arg === '--help') {
    usage()
    process.exit(0)
  }
  console.error(`Unknown argument: ${arg}`)
  usage()
  process.exit(2)
}

let raw
try {
  raw = execFileSync('git', ['ls-tree', '-r', '-z', ref], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (error) {
  const detail = error?.stderr?.toString().trim() || error?.message || String(error)
  console.error(`Graphify input fingerprint: unable to read ${ref}: ${detail}`)
  process.exit(1)
}

const entries = raw
  .split('\0')
  .filter(Boolean)
  .map((entry) => {
    const separator = entry.indexOf('\t')
    if (separator === -1) {
      throw new Error(`unexpected git ls-tree entry: ${entry}`)
    }
    const metadata = entry.slice(0, separator).split(' ')
    const objectId = metadata[2]
    const path = entry.slice(separator + 1)
    if (!/^[0-9a-f]{40,64}$/.test(objectId ?? '')) {
      throw new Error(`unexpected git object id for ${path}: ${objectId ?? '<missing>'}`)
    }
    return { objectId, path }
  })
  .filter(({ path }) => isGraphifyInput(path))
  .sort((left, right) => left.path.localeCompare(right.path))

const digest = createHash('sha256')
for (const { objectId, path } of entries) {
  digest.update(path)
  digest.update('\0')
  digest.update(objectId)
  digest.update('\0')
}

console.log(`sha256:${digest.digest('hex')}`)
