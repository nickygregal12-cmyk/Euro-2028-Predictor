#!/usr/bin/env node
// What may autonomous repository work do, and who may do it?
//
// Stage 4 of the control-plane programme. #1041 proposed this authority with no
// identity beneath it and expressed the boundary as agent prompt text, which
// constrains a cooperative model and nothing else.
//
// This command reports the effective policy — the permanent refusals, the
// granted operations, and the identity lane each is decided against — and is
// the offline gate CI runs on any pull request that would widen it. It performs
// no network call and grants nothing: it answers questions.
//
//   node scripts/check-pre-live-owner-authority.mjs            report and validate
//   node scripts/check-pre-live-owner-authority.mjs <op>       decide one operation

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { ALWAYS_DENIED, decideOperation, deniedOperations, evaluateAuthorityPolicy } from './control-plane/authority.mjs'

const POLICY_PATH = 'config/pre-live-owner-authority.json'
const IDENTITY_PATH = 'config/control-plane-identity.json'

/** @param {string} path */
const read = (path) => JSON.parse(readFileSync(path, 'utf8'))

function main() {
  const policy = read(POLICY_PATH)
  const identity = read(IDENTITY_PATH)

  const requested = process.argv.slice(2).filter((argument) => !argument.startsWith('-'))[0]
  if (requested) {
    const verdict = decideOperation(policy, identity, requested)
    console.log(`${verdict.allowed ? 'ALLOW' : 'DENY '} ${requested}${verdict.reason ? ` — ${verdict.reason}` : ''}`)
    if (!verdict.allowed) process.exit(1)
    return
  }

  const structural = evaluateAuthorityPolicy(policy)
  console.log(`Authority mode: ${policy.mode}, acting as identity lane '${policy.lane}'`)

  console.log('\nPermanently denied — in code, so editing the record cannot remove one:')
  for (const [operation, reason] of Object.entries(deniedOperations(policy))) {
    const owner = Object.hasOwn(ALWAYS_DENIED, operation) ? 'code  ' : 'record'
    console.log(`  DENY  [${owner}] ${operation.padEnd(20)} ${reason}`)
  }

  console.log('\nGranted, subject to the acting lane holding the authority:')
  for (const operation of structural.operations) {
    const verdict = decideOperation(policy, identity, operation.name)
    const mark = verdict.allowed ? 'ALLOW' : 'DENY '
    console.log(`  ${mark} ${operation.name.padEnd(20)} needs ${operation.requires}${verdict.allowed ? '' : ` — ${verdict.reason}`}`)
  }

  console.log('\nEverything else is denied by absence: this is an allowlist.')

  if (!structural.ok) {
    console.error('\nThe authority policy is not coherent:')
    for (const problem of structural.problems) console.error(`  ${problem}`)
    console.error('')
    console.error('Widening this policy needs an operation that is safe at the lane\'s authority')
    console.error('ceiling. Raising the ceiling is an identity change, not a policy change.')
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
