#!/usr/bin/env node
// Keep the documents that describe current state current, and make the sweep a
// gate rather than a habit.
//
// The problem this exists for, measured rather than asserted: on 5 August 2026
// the repository was at contract 109 and SIX of nine live-authority documents
// named 107 as their newest. Not one was wrong when written. Each was made
// stale by a later merge that had no reason to touch it, and the cost was paid
// afterwards by separate reconciliation pull requests that had to rediscover
// what had drifted.
//
// The family of bespoke per-contract guards that grew alongside that — one test
// per contract, asserting literal phrases — has its own failure mode. Two of
// them failed today on prose rather than content: one could not see
// "Contract 108" because the line wrapped between the word and the number, and
// another could not see contract 109 in "Contract 107–109". A guard that forces
// the writing to get worse to satisfy it is a guard that will be worked around.
//
// So this checks two things, neither of which is a phrase:
//
//   FRESHNESS  a document that names contract numbers must name the current one
//              as its highest. Naming none is always fine — a document that
//              states no numbers cannot be stale about them, which is the
//              repository's own stated preference for the roadmap.
//
//   SWEEP      a change that adds a migration must also touch every document
//              marked `sweep`. This is the half that stops the drift happening,
//              rather than detecting it a day later.
//
// Dated evidence — audits, investigations, reconciliations, automation runs,
// nightly reports — is exempt BY CLASSIFICATION rather than by being forgotten.
// Those documents are snapshots and must keep saying what was true when they
// were written.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()

/** @param {string} [root] */
export function loadManifest(root = ROOT) {
  return JSON.parse(
    readFileSync(resolve(root, 'config/documentation-authorities.json'), 'utf8'),
  )
}

/** @param {string} [root] */
export function currentContract(root = ROOT) {
  return JSON.parse(
    readFileSync(resolve(root, 'config/deployment-contract.json'), 'utf8'),
  ).requiredMigrationCount
}

// "contract 109", "Contract-109", "Contracts 107–109", "contracts 98-110".
//
// The trailing group is deliberately GREEDY over range parts. A lazy match
// stops at the first number it can, which reads "Contract 107–109" as naming
// 107 and not 109 — precisely the mistake that let a document claiming to
// cover 109 look stale. Every dash the prose actually uses is accepted,
// including the en and em dashes this repository writes ranges with.
const CONTRACT_MENTION =
  /\bcontracts?[-\s]+(\d{2,3}(?:\s*[–—-]\s*\d{2,3})*)/gi

/** @param {string} text */
export function namedContracts(text) {
  const found = new Set()
  for (const match of text.matchAll(CONTRACT_MENTION)) {
    for (const digits of match[1].matchAll(/\d{2,3}/g)) {
      found.add(Number(digits[0]))
    }
  }
  return [...found].sort((a, b) => a - b)
}

// `live` documents describe CURRENT state, so naming an older contract as their
// newest means they have been overtaken.
//
// `dispositions` documents — the risk register, the deferred-decisions register
// — are live, but their contract references say which contract resolved a
// particular entry. A register has nothing to say about a contract that closed
// no entry, and forcing it to name one would make it lie. They are held only to
// the rule that cannot be innocent: never name a contract that does not exist.
/**
 * @param {{authorities: Array<{path: string, kind: string, sweep?: boolean, allow?: number[]}>}} manifest
 * @param {number} contract
 * @param {string} [root]
 */
export function checkFreshness(manifest, contract, root = ROOT) {
  const problems = []
  for (const entry of manifest.authorities) {
    if (entry.kind !== 'live' && entry.kind !== 'dispositions') continue
    let text
    try {
      text = readFileSync(resolve(root, entry.path), 'utf8')
    } catch {
      problems.push(`${entry.path}: listed as a documentation authority but not present`)
      continue
    }
    const allowed = new Set(entry.allow ?? [])
    const named = namedContracts(text).filter((n) => !allowed.has(n))
    if (named.length === 0) continue
    const highest = named[named.length - 1]

    if (highest > contract) {
      problems.push(
        `${entry.path}: names contract ${highest}, which does not exist — the repository is at ${contract}.`,
      )
      continue
    }
    if (entry.kind === 'live' && highest !== contract) {
      problems.push(
        `${entry.path}: newest contract named is ${highest}, but the repository is at ${contract}. ` +
          `Either bring it up to date or stop naming contract numbers in it.`,
      )
    }
  }
  return problems
}

/**
 * @param {string} base
 * @param {string} head
 */
export function changedFiles(base, head) {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', `${base}...${head}`],
    { encoding: 'utf8' },
  )
  return out.split('\n').filter(Boolean)
}

/**
 * @param {string} base
 * @param {string} head
 */
export function addedMigrations(base, head) {
  const out = execFileSync(
    'git',
    ['diff', '--name-status', '--diff-filter=A', `${base}...${head}`],
    { encoding: 'utf8' },
  )
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t')[1])
    .filter((path) => path?.startsWith('supabase/migrations/'))
}

/**
 * @param {{authorities: Array<{path: string, sweep?: boolean}>}} manifest
 * @param {string[]} added
 * @param {string[]} changed
 */
export function checkSweep(manifest, added, changed) {
  if (added.length === 0) return []
  const touched = new Set(changed)
  const missing = manifest.authorities
    .filter((entry) => entry.sweep)
    .map((entry) => entry.path)
    .filter((path) => !touched.has(path))
  if (missing.length === 0) return []
  return [
    `This change adds ${added.length} migration(s) — ${added.join(', ')} — ` +
      `but leaves ${missing.length} live authority document(s) untouched:\n` +
      missing.map((path) => `  - ${path}`).join('\n') +
      `\nA contract that advances without them is the drift this gate exists to stop. ` +
      `If one of them genuinely has nothing to say about this contract, say so in it.`,
  ]
}

function main() {
  const [, , base, head] = process.argv
  const manifest = loadManifest()
  const contract = currentContract()
  const problems = [...checkFreshness(manifest, contract)]

  if (base && head) {
    problems.push(
      ...checkSweep(manifest, addedMigrations(base, head), changedFiles(base, head)),
    )
  }

  if (problems.length > 0) {
    console.error('Documentation authorities are out of step:\n')
    for (const problem of problems) console.error(`  ${problem}\n`)
    process.exit(1)
  }
  console.log(
    `Documentation authorities agree with contract ${contract}` +
      (base && head ? ' and the sweep is complete.' : '.'),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
