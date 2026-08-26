/**
 * The thing that ends a wait.
 *
 * By Stage 7 every piece of this existed and none of them were joined up.
 * `observe.mjs` fetches a pull request. `experience.mjs` says whose failure it
 * is. `github.mjs` triages and `policy.mjs` routes. `delivery.push` parks on
 * `WAITING_CI` with `nextAction: 'a watcher supplies check evidence for this
 * head'`. Nothing was that watcher, so the wait had no end: the pieces could
 * answer the question and nobody ever asked it.
 *
 * `ci.watch` asks it. One bounded task: read the pull request, route it, and
 * move the PARKED task accordingly. It decides nothing itself —
 * `routeFromBlockers` already returns `MERGE`, `REPAIR_CI`, `ADDRESS_REVIEW`,
 * `MERGE_BASE`, `WATCH_CI` or `RECONCILE`, and this maps those onto task state.
 * Adding a second opinion here would mean two places deciding mergeability,
 * which is one more than can ever agree.
 *
 * WHAT IT WILL NOT DO IS MERGE. `pr.merge` is in `ALWAYS_DENIED` in
 * `authority.mjs` — in code, not in a config file, so it cannot be edited away.
 * A green verdict therefore ends as evidence, not as a merge. Lifting that is a
 * deliberate change to the enforcement surface, which goes through review by
 * hand: the canary refuses to deliver one, and it should.
 *
 * EVIDENCE BELONGS TO THE COMMIT IT RAN AGAINST. The expected head is supplied
 * by the task and compared, never taken from whatever the pull request happens
 * to say now. A push during the wait moves the head, and applying the old
 * verdict to the new commit is the same fail-open `decideCanaryMerge` exists to
 * prevent — reached from the other side.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalisePullRequest, triagePullRequest } from './github.mjs'
import { observePullRequest } from './observe.mjs'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * The required contexts, read from the tracked record of the live ruleset.
 *
 * Not a copy kept here. `config/required-merge-contexts.json` exists because a
 * required-check set is HOSTED state that a clone cannot see, and the overnight
 * run that produced it found two places in this repository asserting a context
 * was required when it was not. A second copy in this file would be a third
 * chance to be wrong about the same thing.
 */
export function requiredMergeContexts() {
  return JSON.parse(
    readFileSync(resolve(REPOSITORY_ROOT, 'config/required-merge-contexts.json'), 'utf8'),
  ).required
}

/**
 * What each route means for the task that is parked.
 *
 * `WATCH_CI` is the only one that keeps waiting. Everything that is not
 * "still running" and not "green" is a hand-off: under the current authority
 * the control plane can observe a red branch and say precisely what is wrong
 * with it, and it cannot write the fix. Parking it on the owner with the route
 * named is the honest end of what this stage can do; autonomous repair is a
 * later one, and pretending otherwise would mean re-queueing a push that was
 * never the problem.
 */
export const ROUTE_OUTCOMES = Object.freeze({
  MERGE: { status: 'COMPLETED', resolved: true },
  WATCH_CI: { status: 'WAITING_CI', resolved: false },
  REPAIR_CI: { status: 'WAITING_OWNER', resolved: true },
  ADDRESS_REVIEW: { status: 'WAITING_OWNER', resolved: true },
  MERGE_BASE: { status: 'WAITING_OWNER', resolved: true },
  RECONCILE: { status: 'WAITING_OWNER', resolved: true },
})

/**
 * Move the parked task to match the route, or leave it parked.
 *
 * @param {{ store: import('./state.mjs').ControlPlaneState, at: string,
 *           watchedTaskId: string, triage: any, expectedHeadSha: string }} input
 * @returns {{ resolved: boolean, status: string, evidence: string }}
 */
export function applyVerdict({ store, at, watchedTaskId, triage, expectedHeadSha }) {
  if (triage.headSha !== expectedHeadSha) {
    // Not a failure and not a pass: this verdict is about a different commit.
    return {
      resolved: false,
      status: 'WAITING_CI',
      evidence: `head moved from ${expectedHeadSha} to ${triage.headSha}; this verdict is not about it`,
    }
  }

  const outcome = /** @type {Record<string, { status: string, resolved: boolean }>} */ (
    ROUTE_OUTCOMES
  )[String(triage.nextAction)]
  if (!outcome) {
    // An unrecognised route is not a pass. Routes are added in `policy.mjs`,
    // and one that arrives here unmapped means the two files have drifted —
    // which must read as "do not act", never as "carry on".
    return {
      resolved: false,
      status: 'WAITING_CI',
      evidence: `unrecognised route ${JSON.stringify(triage.nextAction)}; refusing to act on it`,
    }
  }

  const blockers = (triage.blockers ?? []).join(', ')
  const evidence =
    outcome.status === 'COMPLETED'
      ? `every required check passed on ${expectedHeadSha}`
      : `${triage.nextAction} on ${expectedHeadSha}: ${blockers || 'no blocker named'}`

  if (outcome.resolved) {
    store.transition(watchedTaskId, /** @type {any} */ (outcome.status), {
      at,
      evidence,
      blocker: outcome.status === 'COMPLETED' ? null : triage.nextAction,
      nextAction:
        outcome.status === 'COMPLETED'
          ? 'mechanically eligible; merging is not this authority to give'
          : `resolve ${triage.nextAction.toLowerCase().replace('_', ' ')}, then re-queue the parked task`,
    })
  }

  return { resolved: outcome.resolved, status: outcome.status, evidence }
}

/**
 * The watcher handler.
 *
 * `read` and `repository` are injectable for the same reason they are in
 * `observe.mjs`: the decision under test is the routing, and it must be
 * provable without a network.
 *
 * @param {{ read?: ((path: string) => Promise<any>) | undefined,
 *           repository?: string | undefined,
 *           requiredCheckNames?: string[] | undefined }} [options]
 */
export function watchHandlers({ read, repository, requiredCheckNames } = {}) {
  const required = requiredCheckNames ?? requiredMergeContexts()
  return {
    'ci.watch': async (/** @type {any} */ { task, store, at }) => {
      const watchedTaskId = task?.watches
      const expectedHeadSha = task?.expectedHeadSha
      if (!watchedTaskId || !expectedHeadSha) {
        return {
          ok: false,
          failureClass: 'UNKNOWN',
          evidence: 'ci.watch needs task.watches and task.expectedHeadSha',
          blocker: 'UNCONFIGURED_WATCH',
        }
      }

      let observed
      try {
        observed = await observePullRequest({ number: task.pullNumber, repository, read })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const { classifyFailure } = await import('./policy.mjs')
        return {
          ok: false,
          failureClass: classifyFailure({ name: 'ci.watch', output: message }),
          evidence: message,
        }
      }

      const pr = normalisePullRequest(observed, {
        requiredCheckNames: required,
        baseSha: task.baseSha,
      })
      const experience = observed.experience ?? {}
      const triage = triagePullRequest(pr, {
        redOnBase: experience.redOnBase ?? [],
        previouslyGreenOnSameSha: experience.previouslyGreenOnSameSha ?? [],
      })

      const verdict = applyVerdict({ store, at, watchedTaskId, triage, expectedHeadSha })

      return {
        ok: true,
        // The watcher parks itself while the answer is still "not yet", so the
        // supervisor comes back to it rather than treating an unfinished watch
        // as finished work.
        status: verdict.resolved
          ? /** @type {const} */ ('COMPLETED')
          : /** @type {const} */ ('WAITING_CI'),
        evidence: verdict.evidence,
        nextAction: verdict.resolved ? null : 'observe this head again',
        checkpoint: {
          at,
          pr: pr.number,
          sha: expectedHeadSha,
          completed: verdict.resolved ? `watch resolved: ${triage.nextAction}` : 'watch pending',
          route: triage.nextAction,
          blockers: triage.blockers ?? [],
        },
      }
    },
  }
}
