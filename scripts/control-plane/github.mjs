/**
 * Deterministic pull-request triage.
 *
 * Fetching is deliberately *not* here. Different callers reach GitHub by
 * different routes (MCP in an agent session, a token-bearing client on the
 * host), and none of them should be able to change the verdict. This module
 * normalises whatever they observed and then decides from that alone.
 */

import {
  classifyFailure,
  evaluateMergeEligibility,
  headHasSettled,
  routeFromBlockers,
} from './policy.mjs'

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
      // from one that was cancelled while measuring this head. All three shapes
      // are accepted for the same reason `headSha` is accepted for the pull
      // request below: callers reach GitHub by different routes, and a check run
      // whose SHA this failed to read would silently classify as UNKNOWN and be
      // routed to repair — the exact failure this field exists to prevent.
      runSha: run.head_sha ?? run.headSha ?? run.runSha,
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

  const failures = pr.requiredChecks
    .filter((check) => check.status === 'completed' && !['success', 'neutral'].includes(check.conclusion))
    .map((check) => ({
      name: check.name,
      conclusion: check.conclusion,
      failureClass: classifyFailure({
        name: check.name,
        output: check.output,
        // A verdict against a commit that is no longer the head describes a
        // commit nobody is proposing to merge. It says a newer push replaced it,
        // not that this branch broke anything.
        //
        // The SHA decides this, not the conclusion. Requiring `cancelled` looked
        // right and was measurably wrong: on `#1046` at 00:21Z a push cancelled
        // `ci` on `0a174be`, and `CI / Required merge gate` — which reports under
        // `always()` and reads `needs.ci.result` — therefore concluded *failure*
        // on that same dead commit. One of the two checks was recognised as
        // replaced and the other was routed to repair, though the same push
        // caused both, and the one routed to repair is a context the ruleset
        // actually requires.
        //
        // Fail-closed is unaffected: stale evidence is not a pass either, so the
        // merge stays blocked while the current head's own runs are awaited. The
        // cost is that a required context which never posts again is waited on
        // rather than repaired — but that is `DOC-001`, a `paths:`-filtered
        // workflow that cannot report, and it blocks the merge under either
        // reading.
        superseded:
          Boolean(check.runSha) && Boolean(pr.headSha) && check.runSha !== pr.headSha,
        redOnBase: redOnBase.includes(check.name),
        previouslyGreenOnSameSha: previouslyGreenOnSameSha.includes(check.name),
      }),
    }))

  const pending = pr.requiredChecks
    .filter((check) => check.status !== 'completed')
    .map((check) => check.name)

  // A superseded check has nothing to repair: that run measured a commit which
  // is no longer the head, and the head has runs of its own either finished or
  // still to come. Repairing it would manufacture work out of a push.
  //
  // So it is re-stated as what it actually is — a check still owed on this head
  // — and routing decides from there. An earlier version short-circuited the
  // whole verdict to WATCH_CI instead, which parked pull requests on CI they
  // were no longer waiting for: a reviewer's changes-requested, a drifted base
  // or an unmergeable branch all vanished behind a push. The blockers reported
  // below are deliberately left uncorrected: cancelled evidence is not a pass,
  // and merge stays fail-closed on the conclusions actually observed.
  const superseded = new Set(
    failures.filter((failure) => failure.failureClass === 'SUPERSEDED').map((f) => f.name),
  )
  const routed = routeFromBlockers(
    merge.blockers.map((blocker) => {
      const owed = /^check_(?!pending:)[^:]+:(.+)$/.exec(blocker)
      return owed && superseded.has(owed[1]) ? `check_pending:${owed[1]}` : blocker
    }),
    { settled: headHasSettled(pr) },
  )

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
