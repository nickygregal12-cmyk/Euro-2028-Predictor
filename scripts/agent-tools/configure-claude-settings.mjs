#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const target = process.argv[2]
if (!target) throw new Error('usage: configure-claude-settings.mjs TARGET')
/** @type {Record<string, unknown>} */
let settings = {}
try {
  const parsed = JSON.parse(readFileSync(target, 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Claude settings must be a JSON object')
  }
  settings = parsed
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}
const existingEnv = settings.env
settings.env = {
  ...(existingEnv !== null && typeof existingEnv === 'object' && !Array.isArray(existingEnv)
    ? existingEnv
    : {}),
  DISABLE_AUTOUPDATER: '1',
}
mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
const temporary = `${target}.${process.pid}.tmp`
writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
chmodSync(temporary, 0o600)
renameSync(temporary, target)
