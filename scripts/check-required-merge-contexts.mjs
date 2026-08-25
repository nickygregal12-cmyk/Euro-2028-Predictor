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

/**
 * A git branch name safe to place in a URL path.
 *
 * The branch is read from a file and then interpolated into the API request, so
 * it is untrusted input by construction even though the file is tracked — which
 * is exactly what CodeQL flagged on this script. Constraining it to the shape a
 * ref can actually have is a better answer than escaping, because a branch that
 * needs escaping here is a branch this record should not be naming.
 */
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/

/**
 * Read the record, and refuse a malformed one with a diagnostic rather than a
 * stack trace.
 *
 * This runs in CI. A partially-written or hand-edited record failing with
 * `Cannot read properties of undefined` tells the person who broke it nothing,
 * and this file's whole argument is that an unverifiable answer is worse than a
 * loud one.
 *
 * @param {string} source
 * @param {string} [path]
 * @returns {RequiredContextRecord}
 */
export function parseRecord(source, path = RECORD_PATH) {
  /** @param {string} problem */
  const refuse = (problem) => {
    throw new Error(`${path} is not a usable required-context record: ${problem}`)
  }

  let record
  try {
    record = JSON.parse(source)
  } catch (error) {
    return refuse(`it is not valid JSON (${error instanceof Error ? error.message : error})`)
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return refuse('the top level is not an object')
  }
  if (typeof record.branch !== 'string' || !SAFE_BRANCH.test(record.branch)) {
    return refuse(`\`branch\` must be a plain branch name, got ${JSON.stringify(record.branch)}`)
  }
  if (!Array.isArray(record.required) || record.required.length === 0) {
    return refuse('`required` must be a non-empty array of context names')
  }
  for (const context of record.required) {
    if (typeof context !== 'string' || context.trim() === '') {
      return refuse(`\`required\` contains ${JSON.stringify(context)}, which is not a context name`)
    }
  }
  if (record.requirableNotRequired !== undefined) {
    if (!Array.isArray(record.requirableNotRequired)) {
      return refuse('`requirableNotRequired` must be an array when present')
    }
    for (const entry of record.requirableNotRequired) {
      if (!entry || typeof entry.context !== 'string' || entry.context.trim() === '') {
        return refuse('every `requirableNotRequired` entry needs a non-empty `context`')
      }
    }
  }
  return record
}

/** @returns {RequiredContextRecord} */
function readRecord() {
  return parseRecord(readFileSync(RECORD_PATH, 'utf8'))
}

/**
 * Which repository the live check is about.
 *
 * A hard-coded fallback was the first version and it was wrong in the way this
 * script exists to prevent: run from a fork or a clone with no
 * `GITHUB_REPOSITORY`, it would read some *other* repository's ruleset and
 * report `MATCHED` with total confidence. An answer about the wrong subject is
 * not a weaker answer, it is a false one.
 *
 * So: the environment if CI set it, otherwise the origin remote, otherwise
 * refuse. The resolved value is printed either way, because an operator should
 * not have to guess what was verified.
 *
 * @param {string | undefined} environmentValue
 * @param {string | undefined} originUrl
 */
export function resolveRepository(environmentValue, originUrl) {
  if (environmentValue) return environmentValue
  const match = /(?:github\.com[:/])([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(originUrl ?? '')
  if (match?.[1]) return match[1]
  throw new Error(
    'cannot tell which repository to verify: set GITHUB_REPOSITORY, or run inside a clone whose origin is a GitHub remote',
  )
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

/** The only host this script is ever allowed to talk to. */
const API_ORIGIN = 'https://api.github.com'

/** An owner or repository name, which cannot contain a path separator. */
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * Build the rules URL so that it cannot address anything but the GitHub API.
 *
 * Both inputs are untrusted by construction: the branch is read from a tracked
 * file and the repository from `git remote`, and CodeQL flagged the first one
 * reaching an outbound request — correctly. Validating the shape was the first
 * answer and it was the weaker one: it argues the value is harmless, which is a
 * claim about every future edit to the record rather than about this code.
 *
 * This asserts the conclusion instead. The URL is assembled through the `URL`
 * parser and its origin is checked against the constant afterwards, so a value
 * that escaped the path — a scheme, a host, an `@`, a traversal — fails here
 * rather than being requested. That holds whatever the record says.
 *
 * @param {string} repository
 * @param {string} branch
 * @param {number} page
 * @param {number} perPage
 */
export function rulesUrl(repository, branch, page, perPage) {
  const parts = repository.split('/')
  const owner = parts[0] ?? ''
  const name = parts[1] ?? ''
  if (parts.length !== 2 || !SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(name)) {
    throw new Error(`not an owner/repo pair: ${JSON.stringify(repository)}`)
  }
  const url = new URL(
    `${API_ORIGIN}/repos/${owner}/${name}/rules/branches/${encodeURIComponent(branch)}`,
  )
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))
  // The assertion, not the escaping, is what makes this safe.
  if (url.origin !== API_ORIGIN) {
    throw new Error(`refusing a request to ${url.origin}`)
  }
  return url
}

/**
 * The default branch, according to the remote rather than according to us.
 *
 * `git ls-remote --symref origin HEAD` answers with `ref: refs/heads/<name>`,
 * which is what the ruleset's `~DEFAULT_BRANCH` condition actually resolves to.
 *
 * @param {string} output
 */
export function defaultBranchFrom(output) {
  const match = /^ref: refs\/heads\/(\S+)\s+HEAD$/m.exec(output)
  if (!match?.[1]) throw new Error('could not read the default branch from origin')
  return match[1]
}

/** @param {RequiredContextRecord} record */
async function fetchEffectiveRules(record) {
  const origin = (() => {
    try {
      return execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
    } catch {
      return ''
    }
  })()
  const repository = resolveRepository(process.env.GITHUB_REPOSITORY, origin)
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token) throw new Error('no GITHUB_TOKEN or GH_TOKEN in the environment')

  // THE BRANCH IS CHECKED AGAINST THE REMOTE, NOT TAKEN FROM THE RECORD. The
  // record naming a branch is a claim, and the same claim the ruleset makes
  // with `~DEFAULT_BRANCH` — so it is compared, never trusted. A record edited
  // to name some other real branch would otherwise send this to verify THAT
  // branch's rules and report MATCHED, while the branch everything merges into
  // sat unprotected. That is the hard-coded-repository bug again, one field
  // along: a confident answer about the wrong subject.
  //
  // It is also why nothing read from the file reaches the request below.
  const branch = defaultBranchFrom(
    execFileSync('git', ['ls-remote', '--symref', 'origin', 'HEAD'], { encoding: 'utf8' }),
  )
  if (branch !== record.branch) {
    throw new Error(
      `the record names '${record.branch}' but origin's default branch is '${branch}'`,
    )
  }

  console.log(`Reading the hosted rules for ${repository}@${branch}`)

  // PAGINATED, because this endpoint is. The default page is 30 rules, and a
  // missed page does not fail — it returns a shorter list, which reads as a
  // branch with fewer rules than it has. That is the one shape this file must
  // never produce: a confident answer assembled from part of the evidence.
  const perPage = 100
  const rules = []
  for (let page = 1; ; page += 1) {
    const response = await fetch(rulesUrl(repository, branch, page, perPage), {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    })
    if (!response.ok) throw new Error(`GitHub answered ${response.status} ${response.statusText}`)
    const body = await response.json()
    if (!Array.isArray(body)) {
      throw new Error('the rules endpoint did not return an array')
    }
    rules.push(...body)
    if (body.length < perPage) return rules
    // A ruleset count this high means something is wrong with the loop rather
    // than with the repository, and an unbounded pager against a remote API is
    // its own failure mode.
    if (page >= 20) throw new Error('the rules endpoint did not stop paginating')
  }
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
