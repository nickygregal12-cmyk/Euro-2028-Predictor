/**
 * Deterministic pull-request triage.
 *
 * Fetching is deliberately *not* here. Different callers reach GitHub by
 * different routes (MCP in an agent session, a token-bearing client on the
 * host), and none of them should be able to change the verdict. This module
 * normalises whatever they observed and then decides from that alone.
 */

import { classifyFailure, evaluateMergeEligibility, nextStateForPullRequest } from './policy.mjs'

/**
 * Required checks are the merge-blocking classes, not every check that ran.
 * Anything the repository declares required must produce an explicit decision:
 * a required decider that never reported is a blocker, never an implicit pass.
 *
 * @param {Record<string, any>} raw
 * @param {{ requiredCheckNames?: string[], baseSha?: string }} [options]
 */
export function normalisePullRequest(raw, { requiredCheckNames = [], baseSha } = {}) {
  const checkRuns = raw.checkRuns ?? []
  const statuses = raw.statuses ?? []

  const observed = new Map()
  for (const run of checkRuns) {
    observed.set(run.name, {
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      // Kept so triage can tell a cancelled run that measured an older commit
      // from one that was cancelled while measuring this head.
      runSha: run.head_sha ?? run.runSha,
    })
  }
  for (const status of statuses) {
    observed.set(status.context, {
      name: status.context,
      status: 'completed',
      conclusion: status.state === 'success' ? 'success' : status.state,
    })
  }

  const requiredChecks = requiredCheckNames.map(
    (name) =>
      observed.get(name) ?? { name, status: 'completed', conclusion: 'missing_decider' },
  )

  return {
    number: raw.number,
    state: raw.state,
    draft: Boolean(raw.draft),
    merged: Boolean(raw.merged),
    headSha: raw.head?.sha ?? raw.headSha,
    baseSha: raw.base?.sha ?? raw.baseSha,
    // Evidence gathered against a stale base is not evidence for today's merge.
    baseChangedSince: Boolean(baseSha && (raw.base?.sha ?? raw.baseSha) !== baseSha),
    // Only GitHub's own boolean counts. `mergeable_state` was tempting to infer
    // from, but it reads 'unknown' while GitHub is still computing mergeability,
    // and 'unknown' !== 'dirty' would have resolved to *mergeable* — failing open
    // on the one question this module exists to answer. Undefined stays
    // undefined and is blocked below.
    mergeable: typeof raw.mergeable === 'boolean' ? raw.mergeable : undefined,
    mergeableState: raw.mergeable_state ?? raw.mergeableState,
    requiredChecks,
    observedChecks: [...observed.values()],
    reviewThreads: raw.reviewThreads ?? [],
    reviews: raw.reviews ?? [],
  }
}

/**
 * Full triage for one PR: merge verdict, the task state it implies, and a
 * classification for every failing check so repair work is typed rather than
 * retried blindly.
 *
 * @param {ReturnType<typeof normalisePullRequest>} pr
 * @param {{ redOnBase?: string[], previouslyGreenOnSameSha?: string[] }} [options]
 */
export function triagePullRequest(pr, { redOnBase = [], previouslyGreenOnSameSha = [] } = {}) {
  const merge = evaluateMergeEligibility(pr)
  const next = nextStateForPullRequest(pr)

  const failures = pr.requiredChecks
    .filter((check) => check.status === 'completed' && !['success', 'neutral'].includes(check.conclusion))
    .map((check) => ({
      name: check.name,
      conclusion: check.conclusion,
      failureClass: classifyFailure({
        name: check.name,
        output: check.output,
        // Cancelled against a commit that is no longer the head means a newer
        // push replaced it, not that this branch broke anything.
        superseded:
          check.conclusion === 'cancelled' &&
          Boolean(check.runSha) &&
          Boolean(pr.headSha) &&
          check.runSha !== pr.headSha,
        redOnBase: redOnBase.includes(check.name),
        previouslyGreenOnSameSha: previouslyGreenOnSameSha.includes(check.name),
      }),
    }))

  const pending = pr.requiredChecks
    .filter((check) => check.status !== 'completed')
    .map((check) => check.name)

  // A pull request whose only failing checks were superseded has nothing to
  // repair: those runs measured a commit that is no longer the head, and the
  // current head has runs of its own. Routing it to repair would manufacture
  // work out of a push. It still cannot merge — cancelled evidence is not a
  // pass — so it waits for the new head's runs instead.
  const onlySuperseded =
    failures.length > 0 && failures.every((failure) => failure.failureClass === 'SUPERSEDED')
  const routed = onlySuperseded
    ? { status: /** @type {const} */ ('WAITING_CI'), nextAction: 'WATCH_CI' }
    : { status: next.status, nextAction: next.nextAction }

  return {
    number: pr.number,
    headSha: pr.headSha,
    mergeEligible: merge.eligible,
    blockers: merge.blockers,
    status: routed.status,
    nextAction: routed.nextAction,
    failures,
    pending,
    unresolvedThreads: (pr.reviewThreads ?? []).filter(
      (/** @type {{ isResolved?: boolean, isOutdated?: boolean }} */ thread) =>
        !thread.isResolved && !thread.isOutdated,
    ).length,
  }
}

/**
 * Merge is fail-closed on the head SHA: if the branch moved since triage, the
 * evidence describes a commit that is no longer what would be merged.
 *
 * @param {ReturnType<typeof triagePullRequest>} triage
 * @param {string} expectedHeadSha
 */
export function mergeGuard(triage, expectedHeadSha) {
  if (!triage.mergeEligible) {
    return { allowed: false, reason: `not_eligible:${triage.blockers.join('|')}` }
  }
  if (triage.headSha !== expectedHeadSha) {
    return { allowed: false, reason: `head_moved:${expectedHeadSha}->${triage.headSha}` }
  }
  return { allowed: true, reason: null, sha: expectedHeadSha }
}
