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
// So this checks three things, none of which is a phrase:
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
//   COVERAGE   every tracked markdown file resolves to exactly one of three
//              states: authority, evidence, or explicitly out of scope with a
//              reason. There is no fourth.
//
// Dated evidence — audits, investigations, reconciliations, automation runs,
// nightly reports — is exempt BY CLASSIFICATION rather than by being forgotten.
// Those documents are snapshots and must keep saying what was true when they
// were written.
//
// WHY COVERAGE WAS ADDED (11 August 2026). The two rules above were sound and
// were working. They only ever applied to the fifteen documents someone had
// thought to list. Measured across the whole repository at contract 157: 238
// tracked markdown files, 15 declared authorities, 122 declared evidence — and
// 101 governed by nothing at all. Fifty-one of those 101 named contract
// numbers, and the oldest named 35.
//
// That is not a gap in the rules. It is a gap in what the rules were pointed
// at, and it is the more dangerous shape, because an unlisted document looks
// exactly like a governed one to a reader. A control that covers the files
// somebody remembered is a control that decays as the repository grows, which
// is the same failure the per-contract guards had.
//
// So the manifest now answers for EVERY file. `authorityDirectories` keeps that
// affordable — an ADR is a decision record whether or not anyone lists it
// individually — and `outOfScope` makes each exception a decision with a reason
// attached rather than an omission.

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
//
// `(?!\d)` ANCHORS THE END OF EACH NUMBER, and it is not defensive tidying.
// Without it, `\d{2,3}` happily takes the first three digits of a longer run
// of digits — so the branch name
// `automation/development-hosted-contract-31417611501` read as "contract 314",
// a contract that will not exist for a century and a half. The coverage rule
// found that on its first run, in a document nothing had been watching. A
// contract number is a whole number or it is not one.
const CONTRACT_MENTION =
  /\bcontracts?[-\s]+(\d{2,3}(?!\d)(?:\s*[–—-]\s*\d{2,3}(?!\d))*)/gi

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

/**
 * @typedef {{path: string, kind: string, sweep?: boolean, allow?: number[], why?: string}} AuthorityEntry
 * @typedef {{prefix: string, kind: string, why?: string}} AuthorityDirectory
 * @typedef {{
 *   authorities?: AuthorityEntry[],
 *   authorityDirectories?: AuthorityDirectory[],
 *   evidenceDirectories?: string[],
 *   outOfScope?: Array<{path: string, why?: string}>,
 * }} Manifest
 */

/** Every tracked markdown file, which is what the coverage rule answers for. */
export function trackedMarkdown() {
  return execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

/**
 * Which of the three states a path is in, and what said so.
 *
 * PRECEDENCE IS ONE RULE, NOT A SPECIAL CASE. An exact path — an authority
 * entry or an out-of-scope entry — always wins, because naming a file is the
 * most specific thing the manifest can do. Otherwise the LONGEST matching
 * directory prefix wins, whichever list it came from. That single rule is what
 * lets `docs/ops/` be procedures while `docs/ops/records/` inside it is
 * evidence, and `docs/quality/` be governance while the four dated
 * subdirectories inside it are evidence — without either nesting needing to be
 * written down as an exception.
 *
 * @param {Manifest} manifest
 * @param {string} path
 * @returns {{state: 'authority'|'evidence'|'out-of-scope'|'unclassified', kind?: string, allow?: number[], by: string}}
 */
export function classify(manifest, path) {
  const named = (manifest.authorities ?? []).find((entry) => entry.path === path)
  if (named) {
    return { state: 'authority', kind: named.kind, allow: named.allow, by: named.path }
  }
  if ((manifest.outOfScope ?? []).some((entry) => entry.path === path)) {
    return { state: 'out-of-scope', by: path }
  }

  let best = null
  for (const entry of manifest.authorityDirectories ?? []) {
    if (path.startsWith(entry.prefix) && (!best || entry.prefix.length > best.by.length)) {
      best = { state: /** @type {const} */ ('authority'), kind: entry.kind, by: entry.prefix }
    }
  }
  for (const prefix of manifest.evidenceDirectories ?? []) {
    if (path.startsWith(prefix) && (!best || prefix.length > best.by.length)) {
      best = { state: /** @type {const} */ ('evidence'), by: prefix }
    }
  }
  return best ?? { state: 'unclassified', by: '' }
}

/**
 * @param {Manifest} manifest
 * @param {string[]} files
 */
export function checkCoverage(manifest, files) {
  const unclassified = files.filter((path) => classify(manifest, path).state === 'unclassified')
  if (unclassified.length === 0) return []
  return [
    `${unclassified.length} tracked markdown file(s) are governed by nothing:\n` +
      unclassified.map((path) => `  - ${path}`).join('\n') +
      `\nEvery document is an authority, dated evidence, or explicitly out of scope. ` +
      `Add it to 'authorities' with a kind and a why, put it under an existing ` +
      `'authorityDirectories' or 'evidenceDirectories' prefix, or list it in ` +
      `'outOfScope' with the reason it cannot go stale.`,
  ]
}

// `live` documents describe CURRENT state, so naming an older contract as their
// newest means they have been overtaken.
//
// `dispositions` documents — the risk register, the deferred-decisions register
// — are live, but their contract references say which contract resolved a
// particular entry. A register has nothing to say about a contract that closed
// no entry, and forcing it to name one would make it lie. They are held only to
// the rule that cannot be innocent: never name a contract that does not exist.
//
// `reference` documents — ADRs, procedures, subsystem references, the design
// system — are held to that same rule and named separately because they mean a
// different thing. A register's number says what RESOLVED an entry; a
// reference's says what BUILT the thing it describes. Neither is a claim about
// where the repository is now, and neither may cite a contract that has never
// existed, which is the only way one of them can be wrong on its face.
/**
 * @param {Manifest} manifest
 * @param {number} contract
 * @param {string} [root]
 * @param {string[]} [files] Tracked markdown, for the directory-classified documents.
 */
export function checkFreshness(manifest, contract, root = ROOT, files = []) {
  const problems = []

  /** @type {Array<{path: string, kind: string, allow?: number[]}>} */
  const subjects = [...(manifest.authorities ?? [])]
  const already = new Set(subjects.map((entry) => entry.path))
  for (const path of files) {
    if (already.has(path)) continue
    const resolved = classify(manifest, path)
    if (resolved.state === 'authority' && resolved.kind) {
      subjects.push({ path, kind: resolved.kind })
    }
  }

  for (const entry of subjects) {
    if (!['live', 'dispositions', 'reference'].includes(entry.kind)) continue
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
  // Loud rather than lenient. If the checkout is too shallow to resolve the
  // range, the sweep cannot run — and a gate that quietly does nothing when its
  // input is missing is worse than no gate, because it reports success.
  let out
  try {
    out = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
      encoding: 'utf8',
    })
  } catch (error) {
    throw new Error(
      `Could not compare ${base}...${head}. The sweep needs enough history to ` +
        `find a common ancestor — check that the checkout is not shallow. ` +
        `git said: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
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
  const files = trackedMarkdown()
  const problems = [
    ...checkCoverage(manifest, files),
    ...checkFreshness(manifest, contract, ROOT, files),
  ]

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
    `Documentation authorities agree with contract ${contract}: ` +
      `${files.length} tracked documents, all classified` +
      (base && head ? ', and the sweep is complete.' : '.'),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
