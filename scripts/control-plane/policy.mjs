/**
 * Deterministic control-plane decisions.
 *
 * Every function here is pure: same inputs, same answer, no clock, no network,
 * no model. The loop engine owns *when* to ask; this module owns *what the
 * answer is*. A worker model may supply evidence, never a verdict.
 */

/**
 * Records are open JSON: handlers attach their own fields (a command, an
 * observation path) and the store round-trips them untouched. The typedefs name
 * what this module actually reads and leaves the rest open rather than
 * pretending to a precision the store does not enforce.
 *
 * @typedef {'QUEUED'|'ELIGIBLE'|'RUNNING'|'CHECKPOINTING'|'WAITING_CI'|'WAITING_REVIEW'|'WAITING_EXTERNAL'|'WAITING_PROVIDER'|'WAITING_OWNER'|'BLOCKED'|'COMPLETED'|'CANCELLED'} TaskState
 *
 * @typedef {{ id: string, status?: TaskState, dependencies?: string[], attempts?: number,
 *   repeatedFailures?: number, mutating?: boolean, order?: number, handler?: string,
 *   [key: string]: any }} Task
 *
 * @typedef {{ runId?: string, startedAt?: string, hardStop?: string, mode?: string,
 *   lastProgressAt?: string, noProgressCycles?: number, emergencyStop?: boolean,
 *   pullRequestsOpened?: number, maxPullRequests?: number, now?: string,
 *   [key: string]: any }} Run
 *
 * @typedef {{ maxAttemptsPerTask: number, maxRepeatedIdenticalFailures: number,
 *   maxNoProgressCycles: number, noProgressStallMs: number, maxPullRequests: number }} Limits
 *
 * @typedef {{ name: string, status?: string, conclusion?: string, output?: string,
 *   runSha?: string }} Check
 *
 * @typedef {{ number?: number, state?: string, draft?: boolean, merged?: boolean,
 *   headSha?: string, baseSha?: string, baseChangedSince?: boolean, mergeable?: boolean|undefined,
 *   requiredChecks?: Check[], reviewThreads?: Array<{ isResolved?: boolean, isOutdated?: boolean }>,
 *   reviews?: Array<{ state?: string }>, [key: string]: any }} PullRequestObservation
 */

/** Task lifecycle states. A task is always in exactly one. */
export const TASK_STATES = Object.freeze([
  'QUEUED',
  'ELIGIBLE',
  'RUNNING',
  'CHECKPOINTING',
  'WAITING_CI',
  'WAITING_REVIEW',
  'WAITING_EXTERNAL',
  'WAITING_PROVIDER',
  'WAITING_OWNER',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
])

/** States that will never transition again without outside intervention. */
export const TERMINAL_STATES = Object.freeze(['COMPLETED', 'CANCELLED', 'BLOCKED'])

/** States parked on something the loop cannot itself advance. */
export const WAITING_STATES = Object.freeze([
  'WAITING_CI',
  'WAITING_REVIEW',
  'WAITING_EXTERNAL',
  'WAITING_PROVIDER',
  'WAITING_OWNER',
])

/**
 * Waiting on an external system, as distinct from waiting on the owner.
 *
 * A programme parked on a thirty-minute CI run is healthy, not stalled, and the
 * difference has to be mechanical: the stall detector counts *idleness*, and
 * without this distinction a run that was doing exactly the right thing —
 * checkpointing a push and standing down — escalated itself to BLOCKED while CI
 * was still legitimately running.
 */
export const EXTERNAL_WAITING_STATES = Object.freeze([
  'WAITING_CI',
  'WAITING_REVIEW',
  'WAITING_EXTERNAL',
  'WAITING_PROVIDER',
])

/**
 * Run modes.
 * OBSERVE_ONLY - reconcile, classify and record, but never dispatch a mutation.
 * ACTIVE       - full dispatch, still inside the safety envelope.
 */
export const RUN_MODES = Object.freeze(['OBSERVE_ONLY', 'ACTIVE'])

export const FAILURE_CLASSES = Object.freeze([
  'BRANCH_CODE_FAILURE',
  'BRANCH_TEST_FAILURE',
  'VISUAL_FAILURE',
  'INHERITED_FAILURE',
  'FLAKY_TEST',
  'CI_INFRA_FAILURE',
  'EXTERNAL_SERVICE_FAILURE',
  'POLICY_DENIAL',
  'AUTH_REQUIRED',
  'PROVIDER_LIMIT',
  'PROVIDER_OUTAGE',
  'HOST_RESOURCE_LIMIT',
  'HOST_UNREACHABLE',
  'SUPERSEDED',
  'UNKNOWN',
])

export const DEFAULT_LIMITS = Object.freeze({
  maxAttemptsPerTask: 3,
  maxRepeatedIdenticalFailures: 2,
  maxNoProgressCycles: 2,
  noProgressStallMs: 15 * 60 * 1000,
  maxPullRequests: 8,
})

/**
 * A task may run only when every dependency has actually completed.
 * A dependency that is merely "waiting" or "blocked" does not satisfy anything —
 * this is what stops a blocked stage from being falsely treated as done.
 *
 * @param {Task} task
 * @param {Record<string, Task>} tasksById
 */
export function dependenciesSatisfied(task, tasksById) {
  const deps = task.dependencies ?? []
  return deps.every((id) => tasksById[id]?.status === 'COMPLETED')
}

/**
 * Why a task cannot be dispatched right now, or null when it can be.
 * Returned as a reason string so the caller records evidence, not a guess.
 *
 * @param {Task} task
 * @param {Record<string, Task>} tasksById
 * @param {Limits} [limits]
 * @returns {string | null}
 */
export function ineligibilityReason(task, tasksById, limits = DEFAULT_LIMITS) {
  const status = task.status ?? 'QUEUED'
  if (TERMINAL_STATES.includes(status)) return `terminal:${status}`
  if (WAITING_STATES.includes(status)) return `waiting:${status}`
  if (!dependenciesSatisfied(task, tasksById)) {
    const missing = (task.dependencies ?? []).filter(
      (id) => tasksById[id]?.status !== 'COMPLETED',
    )
    return `dependencies:${missing.join(',')}`
  }
  if ((task.attempts ?? 0) >= limits.maxAttemptsPerTask) return 'attempts_exhausted'
  if ((task.repeatedFailures ?? 0) >= limits.maxRepeatedIdenticalFailures) {
    return 'repeated_identical_failure'
  }
  return null
}

/**
 * How many still-open tasks are waiting, directly or transitively, on this one.
 * Used to prefer work that unblocks the most other work.
 *
 * @param {string} taskId
 * @param {Task[]} tasks
 * @returns {number}
 */
export function countDownstream(taskId, tasks) {
  const open = tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(t.status ?? 'QUEUED'))
  const seen = new Set()
  let frontier = [taskId]
  while (frontier.length > 0) {
    const next = []
    for (const task of open) {
      if (seen.has(task.id)) continue
      if ((task.dependencies ?? []).some((dep) => frontier.includes(dep))) {
        seen.add(task.id)
        next.push(task.id)
      }
    }
    frontier = next
  }
  return seen.size
}

/**
 * Pick the next task to run.
 *
 * Deterministic, and ordered by what most improves programme throughput: an
 * explicit priority first, then how much work this task unblocks, then the
 * declared order, then the id as a final tie-break. Preferring the task that
 * frees the most downstream work is what stops a long external wait on one
 * branch from deciding the pace of everything behind it.
 *
 * Never picks a mutating task while mutation dispatch is closed.
 *
 * @param {Run} run
 * @param {Task[]} tasks
 * @param {Limits} [limits]
 * @returns {Task | null}
 */
export function selectEligibleTask(run, tasks, limits = DEFAULT_LIMITS) {
  const tasksById = Object.fromEntries(tasks.map((task) => [task.id, task]))
  const mutationAllowed = mutationDispatchAllowed(run).allowed

  const runnable = tasks
    .filter((task) => ineligibilityReason(task, tasksById, limits) === null)
    .filter((task) => (task.mutating ? mutationAllowed : true))
    .sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0) ||
        countDownstream(b.id, tasks) - countDownstream(a.id, tasks) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.id.localeCompare(b.id),
    )

  return runnable[0] ?? null
}

/**
 * Mutation dispatch is closed by emergency stop, by OBSERVE_ONLY mode, by the
 * hard stop, and by the PR ceiling. Read-only reconciliation stays open in all
 * of those cases so the ledger keeps converging on truth.
 *
 * @param {Run} run
 * @param {Limits} [limits]
 * @returns {{ allowed: boolean, reason: string | null }}
 */
export function mutationDispatchAllowed(run, limits = DEFAULT_LIMITS) {
  if (run.emergencyStop) return { allowed: false, reason: 'EMERGENCY_STOP' }
  if (run.mode === 'OBSERVE_ONLY') return { allowed: false, reason: 'OBSERVE_ONLY' }
  if (run.hardStop && run.now && Date.parse(run.now) >= Date.parse(run.hardStop)) {
    return { allowed: false, reason: 'HARD_STOP' }
  }
  if ((run.pullRequestsOpened ?? 0) >= (run.maxPullRequests ?? limits.maxPullRequests)) {
    return { allowed: false, reason: 'PR_BUDGET_EXHAUSTED' }
  }
  return { allowed: true, reason: null }
}

/**
 * Progress is evidence, not elapsed time. Polling unchanged GitHub state is not
 * progress, so the caller only stamps `lastProgressAt` on a real transition.
 *
 * @param {Run} run
 * @param {string} nowIso
 * @param {Limits} [limits]
 */
export function assessLiveness(run, nowIso, limits = DEFAULT_LIMITS) {
  const since = Date.parse(nowIso) - Date.parse(run.lastProgressAt ?? run.startedAt ?? nowIso)
  const stalled = since >= limits.noProgressStallMs
  const cycles = run.noProgressCycles ?? 0
  if (stalled && cycles + 1 >= limits.maxNoProgressCycles) {
    return { verdict: 'BLOCKED', sinceMs: since, nextNoProgressCycles: cycles + 1 }
  }
  if (stalled) return { verdict: 'STALLED', sinceMs: since, nextNoProgressCycles: cycles + 1 }
  return { verdict: 'LIVE', sinceMs: since, nextNoProgressCycles: cycles }
}

/**
 * Classify a CI failure from its observable shape.
 * Deliberately conservative: anything not positively recognised is UNKNOWN and
 * gets a human-shaped diagnosis task rather than an automatic retry. "Flake" is
 * never inferred from a failure alone — only from a prior green on the same SHA.
 *
 * @param {{ name?: string, output?: string, hostUnreachable?: boolean, policyDenied?: boolean,
 *   redOnBase?: boolean, previouslyGreenOnSameSha?: boolean, superseded?: boolean }} signal
 * @returns {string}
 */
export function classifyFailure(signal) {
  const text = `${signal.name ?? ''} ${signal.output ?? ''}`.toLowerCase()

  // A run cancelled because a newer commit replaced the one it was measuring
  // did not fail; it was abandoned, and the new head has its own run. Observed
  // twice on 24 August 2026 on PR #1044, where pushing a fix mid-run left the
  // merge gate reporting `CI_RESULT: cancelled` against a commit that was no
  // longer the head. Classified first, because the cancellation reason matters
  // more than anything else the output happens to contain.
  if (signal.superseded) return 'SUPERSEDED'
  if (signal.hostUnreachable) return 'HOST_UNREACHABLE'
  if (signal.policyDenied) return 'POLICY_DENIAL'
  if (/\b(401|403|unauthorized|forbidden|bad credentials)\b/.test(text)) return 'AUTH_REQUIRED'
  if (/\b(429|rate limit|quota exceeded)\b/.test(text)) return 'PROVIDER_LIMIT'
  if (/\b(502|503|504|service unavailable|upstream)\b/.test(text)) return 'PROVIDER_OUTAGE'
  if (/(out of memory|oom|enospc|no space left|killed)/.test(text)) return 'HOST_RESOURCE_LIMIT'
  if (/(runner|checkout failed|actions\/checkout|network is unreachable|etimedout)/.test(text)) {
    return 'CI_INFRA_FAILURE'
  }
  if (signal.redOnBase) return 'INHERITED_FAILURE'
  if (signal.previouslyGreenOnSameSha) return 'FLAKY_TEST'
  if (/(visual|lost-pixel|screenshot|snapshot mismatch)/.test(text)) return 'VISUAL_FAILURE'
  // Assertion-shaped output is the common vitest/playwright failure surface and
  // rarely names the runner, so match the assertion itself as well as the tool.
  if (
    /(test|spec|vitest|playwright|assertionerror|\bassert\b)/.test(text) ||
    /expected .* to (be|equal|contain|match|throw)/.test(text)
  ) {
    return 'BRANCH_TEST_FAILURE'
  }
  if (/(tsc|typecheck|lint|build|compile)/.test(text)) return 'BRANCH_CODE_FAILURE'
  return 'UNKNOWN'
}

/** Failure classes the loop must never try to "fix" by changing branch code. */
export const NOT_OUR_CODE = Object.freeze([
  'SUPERSEDED',
  'INHERITED_FAILURE',
  'CI_INFRA_FAILURE',
  'EXTERNAL_SERVICE_FAILURE',
  'PROVIDER_LIMIT',
  'PROVIDER_OUTAGE',
  'HOST_RESOURCE_LIMIT',
  'HOST_UNREACHABLE',
  'AUTH_REQUIRED',
])

/**
 * Merge eligibility, decided from observed GitHub state alone.
 *
 * A model asserting "this is ready" is not an input here and cannot become one.
 * Every blocking reason is returned, so the report says exactly what is missing
 * rather than a single first-failure.
 *
 * @param {PullRequestObservation} pr
 * @returns {{ eligible: boolean, blockers: string[] }}
 */
export function evaluateMergeEligibility(pr) {
  /** @type {string[]} */
  const blockers = []

  if (pr.state !== 'open') blockers.push(`state:${pr.state}`)
  if (pr.draft) blockers.push('draft')
  if (pr.merged) blockers.push('already_merged')
  if (pr.mergeable === false) blockers.push('not_mergeable')
  // Unconfirmed is not the same as mergeable. GitHub computes mergeability
  // asynchronously and reports null until it has, so anything short of an
  // explicit true blocks and is re-read later.
  else if (pr.mergeable !== true) blockers.push('mergeability_unconfirmed')
  if (pr.baseChangedSince) blockers.push('base_drift_invalidates_evidence')

  const required = pr.requiredChecks ?? []
  if (required.length === 0) blockers.push('no_required_checks_observed')
  for (const check of required) {
    if (check.status !== 'completed') {
      blockers.push(`check_pending:${check.name}`)
      continue
    }
    // A cancelled or skipped *required* decider is not a pass. Missing evidence
    // fails closed; only an explicit success counts as one.
    const conclusion = check.conclusion ?? 'missing_decider'
    if (!['success', 'neutral'].includes(conclusion)) {
      blockers.push(`check_${conclusion}:${check.name}`)
    }
  }

  const unresolved = (pr.reviewThreads ?? []).filter(
    (thread) => !thread.isResolved && !thread.isOutdated,
  )
  if (unresolved.length > 0) blockers.push(`unresolved_review_threads:${unresolved.length}`)

  const blockingReviews = (pr.reviews ?? []).filter((r) => r.state === 'CHANGES_REQUESTED')
  if (blockingReviews.length > 0) blockers.push(`changes_requested:${blockingReviews.length}`)

  return { eligible: blockers.length === 0, blockers }
}

/**
 * Has everything on this head finished running?
 *
 * Every OBSERVED check, not just the required ones: a required aggregate with no
 * run of its own is owed precisely while the job it aggregates is still going,
 * and that job is usually not itself required. One definition, used by both
 * routing callers, because two would eventually disagree about the same head.
 *
 * An empty observation counts as settled — nothing is running — which is the
 * stricter reading and keeps a pull request with no checks at all routing to
 * repair rather than to a wait that nothing would end.
 *
 * @param {any} pr
 * @returns {boolean}
 */
export function headHasSettled(pr) {
  return (pr?.observedChecks ?? []).every(
    (/** @type {any} */ check) => check?.status === 'completed',
  )
}

/**
 * Route a pull request from its blockers alone.
 *
 * Split out from `nextStateForPullRequest` so a caller holding better evidence
 * than the raw conclusions — which cancelled runs measured a commit that is no
 * longer the head, say — can correct the blocker set and still reach the verdict
 * through this one function rather than second-guessing it afterwards.
 *
 * Actionable blockers are read before waiting ones. Waiting is what the loop
 * does when there is nothing it can do, so a pull request that is both awaiting
 * CI and carrying a reviewer's changes-requested has work available now, and
 * parking it on the slower of the two answers is how CI latency becomes
 * programme latency.
 *
 * @param {string[]} blockers
 * @param {{ settled?: boolean }} [observation] `settled` is false while any
 *   check on the head is still running. It defaults to true so a caller that
 *   cannot tell gets the stricter reading: a required context with no run is
 *   treated as missing rather than as owed.
 * @returns {{ status: TaskState, nextAction: string, blockers: string[] }}
 */
export function routeFromBlockers(blockers, { settled = true } = {}) {
  if (blockers.length === 0) return { status: 'ELIGIBLE', nextAction: 'MERGE', blockers }

  // Every non-pending check blocker routes to repair, not just failure and
  // cancelled. `evaluateMergeEligibility` emits `check_<conclusion>:` for any
  // conclusion that is not an explicit pass — skipped, timed_out,
  // action_required, missing_decider — and naming only two of them here left
  // the rest falling through to a wait that nothing would ever end.
  // A required context with NO RUN AT ALL is owed while anything on this head is
  // still running, and missing once everything has settled.
  //
  // `missing_decider` is what `normalisePullRequest` substitutes for a required
  // name it did not observe, and both readings are real: on a freshly pushed
  // head it is the aggregate job not having started, and on `DOC-001` it is a
  // `paths:`-filtered workflow that will never report. Routing it by conclusion
  // alone has to be wrong about one of them, so it is routed by whether the head
  // has settled instead.
  //
  // Found by running the watcher against a live pull request rather than a
  // fixture: two minutes after the push, `ci` was in progress and the aggregate
  // `CI / Required merge gate` had no run, so a perfectly healthy branch routed
  // to REPAIR_CI and the watcher handed it to the owner as broken. You cannot
  // repair a check that has not run — but you also cannot wait forever for one
  // that never will, which is why settling is the discriminator and not time.
  //
  // Merge is unaffected either way: `check_missing_decider:` stays a blocker, so
  // this only ever turns repairing into waiting, never blocked into eligible.
  const owedNotBroken = (/** @type {string} */ blocker) =>
    blocker.startsWith('check_pending:') ||
    (!settled && blocker.startsWith('check_missing_decider:'))

  if (blockers.some((b) => b.startsWith('check_') && !owedNotBroken(b))) {
    return { status: 'ELIGIBLE', nextAction: 'REPAIR_CI', blockers }
  }
  if (
    blockers.some(
      (b) => b.startsWith('unresolved_review_threads:') || b.startsWith('changes_requested:'),
    )
  ) {
    return { status: 'ELIGIBLE', nextAction: 'ADDRESS_REVIEW', blockers }
  }
  if (blockers.includes('not_mergeable') || blockers.includes('base_drift_invalidates_evidence')) {
    return { status: 'ELIGIBLE', nextAction: 'MERGE_BASE', blockers }
  }
  if (blockers.some(owedNotBroken)) {
    return { status: 'WAITING_CI', nextAction: 'WATCH_CI', blockers }
  }
  return { status: 'WAITING_EXTERNAL', nextAction: 'RECONCILE', blockers }
}

/**
 * Map an observed PR into the task state the loop should park it in.
 * This is what removes waiting from the model: after a push the worker stops,
 * and this function alone decides whether anything needs waking.
 *
 * @param {PullRequestObservation} pr
 * @returns {{ status: TaskState, nextAction: string, blockers: string[] }}
 */
export function nextStateForPullRequest(pr) {
  return routeFromBlockers(evaluateMergeEligibility(pr).blockers, { settled: headHasSettled(pr) })
}
