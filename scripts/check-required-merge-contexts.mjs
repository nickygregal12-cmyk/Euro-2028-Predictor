#!/usr/bin/env node
// The required-check set is hosted state, and this repository kept asserting it
// from prose.
//
// On 25 August 2026 both #1047 and a comment in `mergeGateConfiguration.test.ts`
// said `vNext merged browser gate` was a context `Protect Main` requires. The
// live ruleset required three contexts and that was not one of them. The claim
// had been true of nothing at any point; it was simply unfalsifiable from a
// clone, so it survived review and got reasoned from.
//
// `MASTER-TODO #33` has asked for the effective ruleset to be verified since
// before that, and every previous attempt recorded the same obstruction: the
// connected tooling could not read rulesets. It can — `GET /rules/branches/{b}`
// needs only read access to the repository — so the verification becomes a
// command rather than a recurring manual investigation.
//
// TWO HALVES, AND ONLY ONE NEEDS A NETWORK.
//
//   OFFLINE (default)  every context the record calls required is published by
//                      a tracked workflow job of exactly that name. GitHub
//                      matches a required context to a check run by name, so a
//                      renamed job silently stops posting the context — and a
//                      required context that never posts blocks every pull
//                      request for ever. This half runs in CI, on the pull
//                      request that would do the renaming.
//
//   --live             the hosted required set is exactly the tracked record.
//                      This half catches drift the repository did not cause and
//                      cannot see: a context added, removed or renamed in
//                      GitHub settings by someone who never touched the code.
//
// Read-only by construction: the live half issues one GET and there is no code
// path here that writes to GitHub. Correcting drift is deliberately not
// automated — changing a ruleset is an owner action, and a control plane that
// could edit its own merge conditions would not be gated by them.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { evaluateRulesetDrift, findUnpublishedContexts } from './control-plane/ruleset.mjs'

const RECORD_PATH = 'config/required-merge-contexts.json'

/**
 * @typedef {object} RequiredContextRecord
 * @property {string} branch
 * @property {string[]} required
 * @property {Array<{ context: string, reason: string }>} [requirableNotRequired]
 */

/**
 * Job-level `name:` values in a workflow file.
 *
 * Job keys sit at two spaces and their `name:` at four, which is what anchors
 * this: a `name:` at any other depth belongs to a step, and a step name is not
 * a check-run name. Parsed by shape rather than with a YAML dependency, the
 * same way `check-workflow-action-pins.mjs` reads these files — the repository
 * has no YAML parser and this does not justify adding one.
 *
 * @param {string} source
 */
export function jobNames(source) {
  const names = []
  for (const line of source.split('\n')) {
    const match = /^ {4}name: *(?:["']([^"']*)["']|(.*?)) *$/.exec(line)
    if (match) names.push((match[1] ?? match[2] ?? '').trim())
  }
  return names.filter(Boolean)
}

/** @returns {RequiredContextRecord} */
function readRecord() {
  return JSON.parse(readFileSync(RECORD_PATH, 'utf8'))
}

function trackedWorkflows() {
  return execFileSync('git', ['ls-files', '.github/workflows/*.yml', '.github/workflows/*.yaml'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
}

/** @param {RequiredContextRecord} record */
function checkOffline(record) {
  const workflows = trackedWorkflows()
  const published = workflows.flatMap((file) => jobNames(readFileSync(file, 'utf8')))
  const unpublished = findUnpublishedContexts({ required: record.required ?? [], jobNames: published })

  if (unpublished.length > 0) {
    console.error(`Required contexts with no workflow job of that name (${RECORD_PATH}):`)
    for (const context of unpublished) console.error(`  ${context}`)
    console.error('')
    console.error('GitHub matches a required context to a check run by name. A context that no')
    console.error('job publishes never posts, and a required context that never posts blocks')
    console.error('every pull request. Rename the job back, or change the ruleset first.')
    return false
  }

  console.log(
    `All ${record.required.length} required contexts are published by a tracked workflow job (${workflows.length} workflows).`,
  )
  for (const context of record.required) console.log(`  ${context}`)
  return true
}

/** @param {RequiredContextRecord} record */
async function fetchEffectiveRules(record) {
  const repository = process.env.GITHUB_REPOSITORY ?? 'nickygregal12-cmyk/Euro-2028-Predictor'
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token) throw new Error('no GITHUB_TOKEN or GH_TOKEN in the environment')

  const response = await fetch(
    `https://api.github.com/repos/${repository}/rules/branches/${record.branch}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    },
  )
  if (!response.ok) throw new Error(`GitHub answered ${response.status} ${response.statusText}`)
  return response.json()
}

/** @param {RequiredContextRecord} record */
async function checkLive(record) {
  // A failed read is reported as UNREADABLE rather than thrown past the caller:
  // "the ruleset could not be read" and "the ruleset is wrong" are both
  // non-passes, and collapsing the first into a crash loses the distinction the
  // operator needs to act.
  let effectiveRules
  try {
    effectiveRules = await fetchEffectiveRules(record)
  } catch (error) {
    console.error(`Could not read the hosted rules: ${error instanceof Error ? error.message : error}`)
    // One failure mode is worth naming rather than leaving as a bare 401. Node's
    // `fetch` ignores HTTPS_PROXY unless told to honour it, so behind a proxy
    // that injects credentials the request arrives unauthenticated — which
    // looks like a permissions problem and is not one.
    if ((process.env.HTTPS_PROXY ?? process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
      console.error('A proxy is configured and Node is not using it. Retry with NODE_USE_ENV_PROXY=1.')
    }
    effectiveRules = null
  }

  const drift = evaluateRulesetDrift({ effectiveRules, record })
  console.log(`\nHosted required set for '${record.branch}': ${drift.status}`)
  console.log(`  rulesets applying: ${drift.rulesetIds.join(', ') || 'none'}`)
  console.log(`  strict (branch must be current): ${drift.strict === null ? 'unknown' : drift.strict}`)
  for (const context of drift.live) console.log(`  required: ${context}`)

  if (drift.ok) {
    console.log('\nThe hosted required set is exactly the tracked record.')
    return true
  }

  console.error('')
  if (drift.reason) console.error(drift.reason)
  for (const context of drift.missing) {
    console.error(`  MISSING     ${context} — the record expects this to gate a merge; it does not.`)
  }
  for (const context of drift.promoted) {
    console.error(`  PROMOTED    ${context} — now required, but the record still lists it as not required.`)
  }
  for (const context of drift.undeclared) {
    console.error(`  UNDECLARED  ${context} — required by the ruleset and absent from the record.`)
  }
  console.error('')
  console.error(`Reconcile ${RECORD_PATH} with the hosted ruleset, or ask the owner to change the`)
  console.error('ruleset. This command will not change it: a ruleset is an owner action, and a')
  console.error('control plane that could edit its own merge conditions would not be gated by them.')
  return false
}

async function main() {
  const record = readRecord()
  let ok = checkOffline(record)
  if (process.argv.includes('--live')) ok = (await checkLive(record)) && ok
  else console.log('\nHosted ruleset: not read. Re-run with --live to verify the required set.')
  if (!ok) process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
