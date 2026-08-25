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
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALWAYS_DENIED, decideOperation, deniedOperations, evaluateAuthorityPolicy } from './control-plane/authority.mjs'

// Resolved from this file, not from the caller's working directory. The
// wrappers invoke this by absolute path without changing directory, so a
// cwd-relative read made every authorised push and pull request fail with
// ENOENT from any subdirectory — a gate that refuses correct work is still a
// broken gate, and the tests missed it by always running from the root.
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const POLICY_PATH = resolve(REPOSITORY_ROOT, 'config/pre-live-owner-authority.json')
const IDENTITY_PATH = resolve(REPOSITORY_ROOT, 'config/control-plane-identity.json')

/** @param {string} path */
const read = (path) => JSON.parse(readFileSync(path, 'utf8'))

function main() {
  const policy = read(POLICY_PATH)
  const identity = read(IDENTITY_PATH)

  // The one repository this programme may write to, taken from the identity
  // record rather than from git configuration or the environment — both of
  // which the thing being constrained can set.
  if (process.argv.includes('--repository')) {
    const repository = identity.repository
    if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
      console.error('the identity record names no valid owner/repo')
      process.exit(1)
    }
    console.log(repository)
    return
  }

  const branchFlag = process.argv.indexOf('--branch')
  const context = branchFlag === -1 ? {} : { branch: process.argv[branchFlag + 1] }

  const requested = process.argv.slice(2).filter((argument) => !argument.startsWith('-'))[0]
  if (requested) {
    const verdict = decideOperation(policy, identity, requested, context)
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
    // A sample task branch, so the report shows the operation's own verdict
    // rather than the refusal every branch-scoped operation gives when asked
    // with no branch at all.
    const sample = policy.operations[operation.name]?.requiresTaskBranch ? { branch: 'feat/sample' } : {}
    const verdict = decideOperation(policy, identity, operation.name, sample)
    const mark = verdict.allowed ? 'ALLOW' : 'DENY '
    const scope = policy.operations[operation.name]?.requiresTaskBranch ? ' on a task branch' : ''
    console.log(`  ${mark} ${operation.name.padEnd(20)} needs ${operation.requires}${scope}${verdict.allowed ? '' : ` — ${verdict.reason}`}`)
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
