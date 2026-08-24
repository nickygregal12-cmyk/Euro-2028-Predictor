#!/usr/bin/env node
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const target = process.argv[2]
if (!target) throw new Error('usage: configure-claude-settings.mjs TARGET')
let settings = {}
try {
  settings = JSON.parse(readFileSync(target, 'utf8'))
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}
settings.env = { ...(settings.env ?? {}), DISABLE_AUTOUPDATER: '1' }
mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
const temporary = `${target}.${process.pid}.tmp`
writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 })
chmodSync(temporary, 0o600)
renameSync(temporary, target)
