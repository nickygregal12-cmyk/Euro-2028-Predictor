/**
 * Experience, in the only form the control plane accepts: evidence.
 *
 * WHAT THIS FIXES. `classifyFailure` has two branches that nothing can reach:
 *
 *     if (signal.redOnBase) return 'INHERITED_FAILURE'
 *     if (signal.previouslyGreenOnSameSha) return 'FLAKY_TEST'
 *
 * `triagePullRequest` takes both as lists, both default to `[]`, and no caller
 * has ever supplied either. So a failure the base branch already had is
 * classified as this branch's, and `FLAKY_TEST` has never once been produced —
 * a policy branch that cannot fire is a policy that does not exist.
 *
 * WHY THIS IS NOT A MEMORY FILE. Nothing here is written down, summarised or
 * carried forward in prose. Both answers are read from GitHub at the moment
 * they are needed, from the commits they are about. Experience that is
 * re-derived cannot go stale, and experience nobody wrote down cannot be
 * quietly edited into something more convenient.
 *
 * "FLAKE" IS A CLAIM ABOUT ONE COMMIT. The only evidence that a check is flaky
 * is that the SAME COMMIT already passed it. Not that it passes elsewhere, not
 * that it looks unrelated, not that a re-run went green afterwards — a check
 * that failed and was then re-run green has no failure left to classify. The
 * case that matters is narrow and this module keeps it narrow: an EARLIER run
 * on this exact SHA succeeded, and the current one did not.
 */

/** Conclusions that are not a failure. `skipped` is a non-answer, not a red. */
const NOT_A_FAILURE = Object.freeze(['success', 'neutral', 'skipped'])

/** @param {any} run */
const finished = (run) => run?.status === 'completed'

/** @param {any} run */
const failed = (run) => finished(run) && !NOT_A_FAILURE.includes(run.conclusion)

/** @param {any} run */
const started = (run) => Date.parse(run?.started_at ?? run?.startedAt ?? '') || 0

/**
 * Group runs by check name, oldest first.
 *
 * `filter=all` returns every run for a commit rather than the latest per name,
 * which is the whole point: the earlier attempt is the evidence.
 *
 * @param {any[]} checkRuns
 * @returns {Map<string, any[]>}
 */
function byName(checkRuns) {
  const grouped = new Map()
  for (const run of checkRuns ?? []) {
    if (!run?.name) continue
    grouped.set(run.name, [...(grouped.get(run.name) ?? []), run])
  }
  for (const [name, runs] of grouped) {
    grouped.set(name, [...runs].sort((a, b) => started(a) - started(b)))
  }
  return grouped
}

/**
 * Checks whose latest run on this commit failed, having already succeeded on it.
 *
 * Two runs of the same name are not evidence of anything on their own — a
 * `paths:`-filtered workflow reports `skipped` twice and that is neither a pass
 * nor a flake. The success has to be real, and it has to come first.
 *
 * @param {any[]} checkRuns every run for one commit, from `filter=all`
 * @returns {string[]}
 */
export function previouslyGreenOnSameSha(checkRuns) {
  const names = []
  for (const [name, runs] of byName(checkRuns)) {
    // "Earlier" is carried by this guard plus the sort, not by a second
    // check: if the latest run failed then it is not the success, so any
    // success in the list precedes it. A `.slice(0, -1)` here looked like it
    // enforced the ordering and enforced nothing — removing it changed no test,
    // which is how it was found.
    const latest = runs.at(-1)
    if (!failed(latest)) continue
    if (runs.some((run) => finished(run) && run.conclusion === 'success')) names.push(name)
  }
  return names
}

/**
 * Checks whose latest run on a commit failed.
 *
 * Used against the BASE commit, where it answers "was this already broken
 * before the branch touched anything" — the difference between a failure this
 * pull request owns and one it inherited.
 *
 * @param {any[]} checkRuns
 * @returns {string[]}
 */
export function failingChecks(checkRuns) {
  return [...byName(checkRuns)]
    .filter(([, runs]) => failed(runs.at(-1)))
    .map(([name]) => name)
}

/**
 * Both answers, read from the two commits they are about.
 *
 * The base read is allowed to fail without failing the whole call: not knowing
 * whether the base is red is a reason to treat a failure as this branch's,
 * which is the conservative answer. Not knowing must never become the
 * convenient answer.
 *
 * @param {{ read: (path: string) => Promise<any>, repository: string,
 *           headSha: string, baseSha?: string | undefined }} input
 * @returns {Promise<{ previouslyGreenOnSameSha: string[], redOnBase: string[],
 *                     baseRead: 'read' | 'unavailable' | 'not-requested' }>}
 */
export async function gatherExperience({ read, repository, headSha, baseSha }) {
  const runsFor = (/** @type {string} */ sha) =>
    read(`repos/${repository}/commits/${sha}/check-runs?per_page=100&filter=all`)

  const head = await runsFor(headSha)

  let redOnBase = /** @type {string[]} */ ([])
  let baseRead = /** @type {'read' | 'unavailable' | 'not-requested'} */ ('not-requested')
  if (baseSha) {
    try {
      redOnBase = failingChecks((await runsFor(baseSha))?.check_runs ?? [])
      baseRead = 'read'
    } catch {
      // Fail towards owning the failure. An unread base means this branch is
      // blamed for something it may not have caused, which costs a diagnosis;
      // assuming the base was red would let a real regression through as
      // INHERITED_FAILURE, which costs the gate.
      baseRead = 'unavailable'
    }
  }

  return {
    previouslyGreenOnSameSha: previouslyGreenOnSameSha(head?.check_runs ?? []),
    redOnBase,
    baseRead,
  }
}
