/**
 * The mutating handlers the delivery canary dispatches.
 *
 * WHY THESE ARE NOT IN cli.mjs. `readOnlyHandlers` there gathers evidence and
 * says so: "Mutating handlers are registered by the caller, never shipped as
 * defaults." Shipping a handler that can push would mean any `cli.mjs run`
 * could push, including one started to look at status. A caller that wants
 * mutation has to say so by registering these.
 *
 * WHAT THE CANARY IS FOR. Not to show that an agent can open a pull request —
 * that has never been in doubt. It is to show the loop: a deterministic
 * scheduler picks the task, a bounded worker does one thing, the worker
 * CHECKPOINTS AND EXITS at the push rather than sitting on CI, and merge
 * eligibility is computed later from observed GitHub state. The interesting
 * moment is the one where nothing is running.
 *
 * FOUR GATES, AND A MODEL IS NOT ANY OF THEM.
 *
 *   1. the scheduler chooses the task (dependencies, priority, attempts)
 *   2. `mutationDispatchAllowed` decides whether mutation may be dispatched
 *   3. the wrapper refuses a target it was not built for
 *   4. the authority policy decides the operation against the identity lane
 *
 * Each handler asks the policy itself before shelling out, even though the
 * wrapper asks again. That is deliberate: the duplicate answer costs a
 * millisecond, and it means a handler invoked from somewhere other than a
 * wrapper still cannot act, while the refusal arrives with a failure class the
 * loop can classify instead of an exit code it cannot.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { decideOperation } from './authority.mjs'
import { mergeGuard, normalisePullRequest, triagePullRequest } from './github.mjs'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * The exit status a wrapper uses for an authority refusal, distinct from a
 * usage error (2) or a validation refusal (1) so the loop can classify it.
 */
export const POLICY_REFUSED = 3

const read = (/** @type {string} */ path) =>
  JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8'))

/**
 * The files that constrain a delivery. A delivery that changes any of them
 * cannot be gated by them: the handler would run the candidate's own wrapper,
 * against the candidate's own policy, and call the result enforcement.
 *
 * Review put this plainly — the wrappers are "advisory for any delivery that
 * modifies enforcement files". Rather than try to run a trusted copy while its
 * own dependencies still resolve through the working tree, the canary refuses
 * to deliver a change to the gate at all. Such a change is exactly the kind
 * that should go through review rather than through automation.
 */
export const ENFORCEMENT_SURFACE = Object.freeze([
  'scripts/agent-tools/owner-branch.sh',
  'scripts/agent-tools/owner-commit.sh',
  'scripts/agent-tools/owner-pr.sh',
  'scripts/agent-tools/owner-task-push.sh',
  'scripts/check-pre-live-owner-authority.mjs',
  'scripts/control-plane/authority.mjs',
  'scripts/control-plane/identity.mjs',
  'scripts/control-plane/delivery.mjs',
  'config/pre-live-owner-authority.json',
  'config/control-plane-identity.json',
])

/**
 * Which enforcement files this working tree has changed against the last
 * reviewed state.
 *
 * `origin/main` is the comparison rather than HEAD, because HEAD on a task
 * branch is the candidate. Only what has already been merged has been through
 * review and the required gates.
 *
 * @param {(argv: string[]) => string} [runCommand]
 * @returns {string[]}
 */
export function modifiedEnforcementFiles(runCommand = shell) {
  const output = runCommand([
    'git', 'diff', '--name-only', 'origin/main', '--', ...ENFORCEMENT_SURFACE,
  ])
  return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

/**
 * Ask the policy before doing anything. A refusal is POLICY, which the loop
 * treats as a real classified failure rather than an unexplained non-zero exit.
 *
 * @param {string} operation
 * @param {string | undefined} branch
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function permitted(operation, branch) {
  return decideOperation(
    read('config/pre-live-owner-authority.json'),
    read('config/control-plane-identity.json'),
    operation,
    branch === undefined ? {} : { branch },
  )
}

/**
 * @typedef {{ at: string, task?: Record<string, any>, store?: any, run?: any }} HandlerContext
 */

/** @param {string[]} argv @param {{ cwd?: string }} [options] */
function shell(argv, { cwd = REPOSITORY_ROOT } = {}) {
  const [command, ...args] = argv
  return execFileSync(/** @type {string} */ (command), args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/**
 * Build the mutating handler set.
 *
 * `runCommand` is injectable so the sequencing can be proved without pushing
 * anything. It is the only seam: the policy check, the ordering and the
 * checkpoint shape are the same in a test as in a live run, because those are
 * the parts under test.
 *
 * @param {{ runCommand?: (argv: string[]) => string, branch: string,
 *           title?: string, body?: string }} options
 */
export function deliveryHandlers({ runCommand = shell, branch, title = '', body = '' }) {
  const wrapper = (/** @type {string} */ name) =>
    resolve(REPOSITORY_ROOT, 'scripts/agent-tools', name)

  /**
   * @param {string} operation
   * @param {() => string} act
   * @param {(output: string) => import('./loop.mjs').HandlerResult} settle
   */
  const guarded = async (operation, act, settle) => {
    const verdict = permitted(operation, branch)
    if (!verdict.allowed) {
      return { ok: false, failureClass: 'POLICY', evidence: verdict.reason ?? operation, blocker: operation }
    }
    const changed = modifiedEnforcementFiles(runCommand)
    if (changed.length > 0) {
      // The gate cannot vouch for a change to itself.
      return {
        ok: false,
        failureClass: 'POLICY',
        evidence: `delivery modifies the enforcement surface: ${changed.join(', ')}`,
        blocker: 'ENFORCEMENT_MODIFIED',
      }
    }

    try {
      return settle(act())
    } catch (error) {
      // A wrapper that refused on authority exits POLICY_REFUSED. Collapsing
      // that into CODE told the loop a policy denial was a defect, so it
      // retried a decision that will never change.
      const status = /** @type {{ status?: number }} */ (error)?.status
      const message = error instanceof Error ? error.message : String(error)
      return status === POLICY_REFUSED
        ? { ok: false, failureClass: 'POLICY', evidence: message, blocker: operation }
        : { ok: false, failureClass: 'CODE', evidence: message }
    }
  }

  return {
    'delivery.branch': async (/** @type {HandlerContext} */ { at }) =>
      guarded('branch.create', () => runCommand(['bash', wrapper('owner-branch.sh'), branch]), () => ({
        ok: true,
        evidence: `created ${branch}`,
        checkpoint: { at, branch, completed: 'branch created' },
      })),

    'delivery.commit': async (/** @type {HandlerContext} */ { at, task }) =>
      guarded('commit.create', () =>
        runCommand(['bash', wrapper('owner-commit.sh'), '--message', task?.message ?? title]), () => ({
        ok: true,
        evidence: `committed on ${branch}`,
        checkpoint: { at, branch, completed: 'commit created' },
      })),

    /**
     * The push, and the point of the whole exercise.
     *
     * It returns WAITING_CI rather than COMPLETED, so the task is parked on
     * external state, its dependants stay blocked, and the worker is released.
     * Nothing polls. The next thing that happens is the queue being rescanned
     * for independent work — which is what stops one branch's half-hour CI run
     * from setting the pace of everything behind it.
     */
    'delivery.push': async (/** @type {HandlerContext} */ { at }) =>
      guarded('branch.push', () => runCommand(['bash', wrapper('owner-task-push.sh')]), () => ({
        ok: true,
        status: /** @type {const} */ ('WAITING_CI'),
        evidence: `pushed ${branch}; awaiting required checks`,
        nextAction: 'a watcher supplies check evidence for this head',
        checkpoint: { at, branch, completed: 'branch pushed', awaiting: 'required checks' },
      })),

    'delivery.pr': async (/** @type {HandlerContext} */ { at }) =>
      guarded('pr.create', () =>
        runCommand(['bash', wrapper('owner-pr.sh'), 'create', '--title', title, '--body', body]), (output) => ({
        ok: true,
        status: /** @type {const} */ ('WAITING_CI'),
        evidence: `pull request opened for ${branch}`,
        nextAction: 'a watcher supplies check evidence for this head',
        checkpoint: { at, branch, completed: 'pull request opened', awaiting: 'required checks', output: output.trim() },
      })),
  }
}

/**
 * Decide whether the canary's pull request may merge, from observed state.
 *
 * A handler, not a step in the push: by the time this runs the worker that
 * pushed is long gone, and the only inputs are what GitHub reported. The model
 * that wrote the change has no say, which is the property being demonstrated.
 *
 * @param {{ observed: any, requiredCheckNames: string[], baseSha: string, expectedHeadSha: string }} input
 * @returns {{ allowed: boolean, reason: string | null, blockers: string[] }}
 */
export function decideCanaryMerge({ observed, requiredCheckNames, baseSha, expectedHeadSha }) {
  const pr = normalisePullRequest(observed, { requiredCheckNames, baseSha })

  // A green check is evidence for the commit it ran against, and for no other.
  // `mergeGuard` compares the pull request's head, which does not catch a
  // required check that succeeded on an earlier commit — measured, not
  // supposed: three required checks all green on 0000old, head NEWHEAD, merge
  // allowed with no blockers at all. That is the fail-open this whole module
  // exists to prevent, so provenance is checked here rather than assumed.
  //
  // An absent run SHA is not evidence for this head either. GitHub's check-run
  // payload carries one; a check whose provenance cannot be read is treated as
  // unproven rather than given the benefit of the doubt.
  const foreign = pr.requiredChecks.filter(
    (check) => check.conclusion === 'success' && check.runSha !== expectedHeadSha,
  )

  const triage = triagePullRequest(pr)
  const guard = mergeGuard(triage, expectedHeadSha)
  const blockers = [
    ...(triage.blockers ?? []),
    ...foreign.map((check) => `evidence_not_for_head:${check.name}`),
  ]

  if (foreign.length > 0) {
    return {
      allowed: false,
      reason: `evidence_not_for_head:${foreign.map((check) => check.name).join('|')}`,
      blockers,
    }
  }
  return { allowed: guard.allowed, reason: guard.reason ?? null, blockers }
}
