#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const target = process.argv[2]
if (!target) throw new Error('usage: merge-cloud-env.mjs TARGET')

const managed = [
  'OPENROUTER_API_KEY',
  'OPENCODE_SERVER_USERNAME',
  'OPENCODE_SERVER_PASSWORD',
  'GITHUB_MCP_TOKEN',
]
const existing = (() => {
  try {
    return readFileSync(target, 'utf8').split(/\r?\n/).filter(Boolean)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
})()
/** @type {Map<string, string>} */
const replacements = new Map()
for (const key of managed) {
  const value = process.env[key]
  if (value === undefined) continue
  if (value.includes('\n') || value.includes('\r')) throw new Error(`${key} contains a newline`)
  replacements.set(key, `${key}=${value}`)
}
/** @type {string[]} */
const output = []
const managedKeys = new Set(managed)
const seenManaged = new Set()
for (const line of existing) {
  const key = line.slice(0, line.indexOf('='))
  if (!managedKeys.has(key)) {
    output.push(line)
    continue
  }
  if (seenManaged.has(key)) continue
  seenManaged.add(key)
  const replacement = replacements.get(key)
  if (replacement !== undefined) {
    output.push(replacement)
    replacements.delete(key)
  } else if (process.env[key] === undefined) output.push(line)
}
output.push(...replacements.values())
mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
const temporary = `${target}.${process.pid}.tmp`
writeFileSync(temporary, `${output.join('\n')}\n`, { mode: 0o600 })
chmodSync(temporary, 0o600)
renameSync(temporary, target)
chmodSync(target, 0o600)
