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

const read = (/** @type {string} */ path) =>
  JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8'))

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
    try {
      return settle(act())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, failureClass: 'CODE', evidence: message }
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
  const triage = triagePullRequest(pr)
  const guard = mergeGuard(triage, expectedHeadSha)
  return { allowed: guard.allowed, reason: guard.reason ?? null, blockers: triage.blockers ?? [] }
}
