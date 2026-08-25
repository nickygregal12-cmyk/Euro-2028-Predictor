#!/usr/bin/env node
// Which identity does autonomous work run as, and may it hold the authority it
// is about to be given?
//
// #1041 proposed giving the Builder task-branch push and pull-request creation
// and never said who would be pushing. On this host the answer is the owner's
// own GitHub user: the read-only verification credential and the write
// credential resolve to the same account. Nothing was wrong with that for
// branch work, and nothing in the repository could have told the difference.
//
// TWO HALVES, AND ONLY ONE NEEDS A NETWORK.
//
//   OFFLINE (default)  the tracked record is internally coherent: known
//                      authority levels and identity classes, no lane holding
//                      more authority than its identity class permits, no
//                      provisioned lane without an actor to attribute to, and
//                      no unprovisioned lane that has quietly named one. This
//                      half runs in CI, on the pull request that would raise a
//                      ceiling.
//
//   --live             each provisioned lane's credential resolves to exactly
//                      the actor the record names, and lanes required to be
//                      distinct actually are. This catches the drift a clone
//                      cannot see: a credential rotated to a different account,
//                      or a lane recorded as having none that has acquired one.
//
// Read-only by construction: the live half issues one GET per distinct
// credential and there is no code path here that writes to GitHub. It never
// prints, stores or returns a credential value — only the login, numeric id and
// account type the credential resolved to.
//
// Provisioning an identity is deliberately not automated. Creating a machine
// account or installation credential is an owner action, and a control plane
// that could mint its own executor identity would not be constrained by one.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { evaluateIdentityRecord, evaluateObservedIdentity } from './control-plane/identity.mjs'

const RECORD_PATH = 'config/control-plane-identity.json'
const API_ORIGIN = 'https://api.github.com'

/**
 * Where each lane's credential is read from at verification time.
 *
 * Environment variables only, and never a file this process parses itself: the
 * protected service env is already imported by `mcp-readiness.sh` into the
 * process that needs it, and adding a second parser for the same 0600 file
 * would be a second thing to get wrong.
 *
 * A lane whose variable is unset is UNRESOLVED, which the decision module
 * treats as a failure for a provisioned lane. That is the intended direction:
 * running the live half without the credentials proves nothing, and must not
 * look like proof.
 */
/** @type {Readonly<Record<string, string[]>>} */
const LANE_CREDENTIAL_ENV = Object.freeze({
  verification: ['GITHUB_MCP_TOKEN', 'GITHUB_TOKEN'],
  repository: ['GITHUB_REPOSITORY_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'],
  deployment: ['GITHUB_DEPLOYMENT_TOKEN'],
})

/**
 * @typedef {{ lanes: Record<string, { authority: string, identityClass: string,
 *             expectedActor: { login: string, id: number, type?: string } | null }>,
 *             distinctFrom?: Record<string, string[]> }} IdentityRecord
 *
 * @typedef {{ readable: boolean, login?: string, id?: number, type?: string, scopes?: string }} ObservedActor
 */

/** @returns {IdentityRecord} */
function readRecord() {
  return JSON.parse(readFileSync(RECORD_PATH, 'utf8'))
}

/**
 * Resolve one credential to its actor.
 *
 * Returns `{ readable: false }` for every failure — absent variable, network
 * error, non-200, malformed body. The caller must not be able to tell an absent
 * credential from a rejected one and treat either as a pass.
 *
 * @param {string | undefined} token
 * @returns {Promise<ObservedActor>}
 */
async function resolveActor(token) {
  if (!token || !/\S/.test(token)) return { readable: false }
  let response
  try {
    response = await fetch(`${API_ORIGIN}/user`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    })
  } catch {
    return { readable: false }
  }
  if (!response.ok) return { readable: false }
  let body
  try {
    body = await response.json()
  } catch {
    return { readable: false }
  }
  if (typeof body?.login !== 'string' || typeof body?.id !== 'number') return { readable: false }
  // The header, not the token. An empty value means the credential is
  // fine-grained or an installation token rather than a classic PAT, which is
  // worth reporting and is not itself a secret.
  return {
    readable: true,
    login: body.login,
    id: body.id,
    type: typeof body.type === 'string' ? body.type : 'unknown',
    scopes: response.headers.get('x-oauth-scopes') ?? '',
  }
}

/**
 * @param {IdentityRecord} record
 * @returns {boolean}
 */
function checkOffline(record) {
  const verdict = evaluateIdentityRecord(record)
  console.log(`Identity record: ${verdict.lanes.length} lane(s)`)
  for (const lane of verdict.lanes) {
    const mark = lane.ok ? 'OK  ' : 'FAIL'
    console.log(`  ${mark} ${lane.name.padEnd(13)} ${lane.identityClass.padEnd(17)} holds ${lane.authority} (ceiling ${lane.ceiling ?? 'unknown'})`)
  }
  if (verdict.ok) return true
  console.error('')
  console.error('The identity record is not coherent:')
  for (const problem of verdict.problems) console.error(`  ${problem}`)
  console.error('')
  console.error('Authority is a function of identity here. Raising a lane above its identity')
  console.error("class's ceiling needs a real distinct actor, not a larger number in this file.")
  return false
}

/**
 * @param {IdentityRecord} record
 * @returns {Promise<boolean>}
 */
async function checkLive(record) {
  console.log('\nResolving each provisioned lane to its actor')

  // One request per distinct token, not per lane: two lanes sharing a
  // credential must resolve identically, and issuing the same GET twice would
  // only hide that.
  /** @type {Map<string, ObservedActor>} */
  const byToken = new Map()
  /** @type {Record<string, ObservedActor>} */
  const observations = {}

  for (const laneName of Object.keys(record.lanes)) {
    const names = LANE_CREDENTIAL_ENV[laneName] ?? []
    const token = names
      .map((name) => process.env[name])
      .find((value) => typeof value === 'string' && /\S/.test(value))
    if (!token) {
      observations[laneName] = { readable: false }
      continue
    }
    let resolved = byToken.get(token)
    if (!resolved) {
      resolved = await resolveActor(token)
      byToken.set(token, resolved)
    }
    observations[laneName] = resolved
  }

  const verdict = evaluateObservedIdentity(record, observations)
  for (const lane of verdict.lanes) {
    const observed = observations[lane.name]
    const scopes = observed?.readable
      ? `, scopes ${observed.scopes ? observed.scopes : '(none — fine-grained or installation token)'}`
      : ''
    console.log(`  ${lane.state.padEnd(21)} ${lane.name.padEnd(13)} ${lane.detail}${scopes}`)
  }

  if (verdict.ok) {
    console.log('\nEvery provisioned lane resolved to exactly the recorded actor.')
    return true
  }
  console.error('')
  console.error('Machine identity is NOT PROVED:')
  for (const problem of verdict.problems) console.error(`  ${problem}`)
  console.error('')
  console.error('This command will not provision or repair an identity. Creating a machine')
  console.error('account or installation credential is an owner action in GitHub settings.')
  return false
}

async function main() {
  const record = readRecord()
  let ok = checkOffline(record)
  if (process.argv.includes('--live')) ok = (await checkLive(record)) && ok
  else console.log('\nActors: not resolved. Re-run with --live to prove each lane.')
  if (!ok) process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
