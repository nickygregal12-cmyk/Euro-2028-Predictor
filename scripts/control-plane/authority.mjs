/**
 * What autonomous repository work is permitted to do, and whether the acting
 * identity may do it.
 *
 * WHY THIS EXISTS AS CODE AND NOT AS PROMPT TEXT. #1041 proposed giving the
 * Builder task-branch push and pull-request creation, expressed as OpenCode
 * permission frontmatter plus instructions in an agent prompt. Prompt text is
 * not an authority boundary: it constrains a cooperative model and nothing
 * else. This module is the boundary — a pure function that answers allow or
 * deny, called before the action rather than described alongside it.
 *
 * TWO PROPERTIES CARRY THE SAFETY, AND BOTH ARE STRUCTURAL.
 *
 * It is an ALLOWLIST. #1041 enumerated forbidden `git` and `gh` invocations,
 * which grants everything nobody thought to forbid — and the dangerous set is
 * open-ended: a new flag, a new subcommand, a shell construct reaching the same
 * effect. An operation this policy does not name is denied because it is not
 * named.
 *
 * The refusals that matter are NOT in the tracked record. `ALWAYS_DENIED` lives
 * here, in code, so that editing the record cannot remove one. A control plane
 * whose forbidden set lives in data it can write is not constrained by it —
 * the same failure the identity gate had before review caught it, where a
 * record could relabel the owner as a machine and grant itself deployment.
 *
 * Authority is not decided here either. This module decides which authority
 * LEVEL an operation needs; whether the acting lane holds that level is
 * `authorityForLane`, from the identity record. So an operation cannot be
 * unlocked by editing this file alone.
 */

import { authorityForLane } from './identity.mjs'

/**
 * Operations no policy may grant, at any authority level, ever.
 *
 * In code rather than in the record, and checked before anything else, so that
 * neither a policy edit nor an identity edit can reach past it. Each is either
 * an owner action, or an action whose whole purpose is to constrain this
 * programme — and a programme that can edit its own constraints has none.
 */
export const ALWAYS_DENIED = Object.freeze({
  'main.push': 'pushing to a protected branch is never autonomous work',
  'branch.force-push': 'rewriting published history destroys the evidence a review was given against',
  'protection.update': 'branch protection is the constraint on this programme, not an object of it',
  'ruleset.update': 'a control plane that could edit its own merge conditions would not be gated by them',
  'pr.merge': 'merge eligibility is computed from observed GitHub state, not held as an authority',
  'production.mutate': 'Production promotion is unauthorised and needs a distinct machine executor first',
  'secret.mutate': 'credentials are an owner boundary; this programme reads none and writes none',
  'hosted.write': 'a hosted environment is not writable merely because a tool can reach it',
  'authority.expand': 'no model may widen what a model is permitted to do',
})

/** Authority levels an operation may require. Mirrors identity.mjs. */
const REQUIRABLE = Object.freeze(['READ_ONLY', 'REPOSITORY_WRITE'])

/**
 * @typedef {{ requires: string, constraint?: string }} OperationPolicy
 * @typedef {{ mode?: string, lane?: string, operations?: Record<string, OperationPolicy>,
 *             additionalDenied?: Record<string, string> }} AuthorityPolicy
 */

/**
 * Every operation this policy refuses, and why.
 *
 * The code-owned set is spread first so that a record repeating one of its keys
 * cannot change the reason, and `additionalDenied` may only add.
 *
 * @param {AuthorityPolicy} policy
 * @returns {Record<string, string>}
 */
export function deniedOperations(policy) {
  return Object.freeze({ ...(policy?.additionalDenied ?? {}), ...ALWAYS_DENIED })
}

/**
 * Structural verdict on the tracked policy alone. No network, no identity.
 *
 * Catches what a clone can see: an unknown required authority, an operation
 * that is both granted and permanently denied, a missing lane, and a policy
 * granting an authority level no lane may ever hold.
 *
 * @param {unknown} policy
 * @returns {{ ok: boolean, operations: Array<{ name: string, requires: string, ok: boolean }>,
 *             problems: string[] }}
 */
export function evaluateAuthorityPolicy(policy) {
  /** @type {string[]} */
  const problems = []

  if (!policy || typeof policy !== 'object') {
    // Fail closed. An unreadable policy reads exactly like one granting
    // nothing, which a caller would happily proceed past.
    return { ok: false, operations: [], problems: ['the authority policy is missing or is not an object'] }
  }

  const parsed = /** @type {AuthorityPolicy} */ (policy)
  if (typeof parsed.lane !== 'string' || parsed.lane.length === 0) {
    problems.push('the policy names no identity lane to act as')
  }
  if (parsed.mode !== 'PRE_LIVE_OWNER') {
    problems.push(`unknown authority mode '${parsed.mode}'`)
  }

  const operations = Object.entries(parsed.operations ?? {})
  if (operations.length === 0) problems.push('the policy grants no operations')

  const evaluated = operations.map(([name, operation]) => {
    const before = problems.length
    const requires = operation?.requires

    if (!REQUIRABLE.includes(requires)) {
      // DEPLOYMENT_EXECUTOR is deliberately not requirable here. PRE_LIVE_OWNER
      // is repository authority; an operation needing deployment authority
      // belongs to a later stage and a distinct machine actor, not to a larger
      // value in this file.
      problems.push(`operation '${name}' requires unknown or out-of-scope authority '${requires}'`)
    }
    if (Object.hasOwn(ALWAYS_DENIED, name)) {
      problems.push(`operation '${name}' is granted by the policy but is permanently denied`)
    }
    return { name, requires: String(requires), ok: problems.length === before }
  })

  for (const name of Object.keys(parsed.additionalDenied ?? {})) {
    if (Object.hasOwn(parsed.operations ?? {}, name)) {
      problems.push(`operation '${name}' is both granted and denied by the policy`)
    }
  }

  return { ok: problems.length === 0, operations: evaluated, problems }
}

/**
 * May this operation be performed?
 *
 * The single entry point an action should call, and the order is the design:
 * permanent denials first, then the allowlist, then the identity check. A
 * denied operation is refused before anything about the caller is consulted,
 * so no identity — however privileged, however recorded — reaches past it.
 *
 * @param {unknown} policy
 * @param {unknown} identityRecord
 * @param {string} operation
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function decideOperation(policy, identityRecord, operation) {
  const denied = deniedOperations(/** @type {AuthorityPolicy} */ (policy ?? {}))
  if (Object.hasOwn(denied, operation)) {
    return { allowed: false, reason: `'${operation}' is denied: ${denied[operation]}` }
  }

  const structural = evaluateAuthorityPolicy(policy)
  if (!structural.ok) {
    return { allowed: false, reason: `the authority policy is not coherent: ${structural.problems[0]}` }
  }

  const parsed = /** @type {AuthorityPolicy} */ (policy)
  const granted = parsed.operations?.[operation]
  if (!granted) {
    // Absence is the refusal. This is the allowlist doing its work, and the
    // message says so rather than implying the operation was considered.
    return { allowed: false, reason: `'${operation}' is not an operation this policy grants` }
  }

  const lane = /** @type {string} */ (parsed.lane)
  const verdict = authorityForLane(identityRecord, lane, granted.requires)
  if (!verdict.allowed) {
    return { allowed: false, reason: `'${operation}' needs ${granted.requires}: ${verdict.reason}` }
  }
  return { allowed: true, reason: null }
}
