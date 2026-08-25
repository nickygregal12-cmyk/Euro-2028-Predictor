/**
 * What the hosted ruleset actually requires, compared with what this repository
 * believes it requires.
 *
 * WHY THIS EXISTS, MEASURED RATHER THAN ASSERTED. On 25 August 2026 two places
 * in this repository stated that `vNext merged browser gate` was one of the
 * contexts `Protect Main` requires: the body of #1047, and a comment in
 * `tests/scripts/mergeGateConfiguration.test.ts` that reasoned about cost from
 * it. The live ruleset required three contexts and that was not one of them.
 * Nothing failed, because nothing could: a required-check set lives in GitHub,
 * a clone cannot see it, and prose asserting hosted state is indistinguishable
 * from prose reporting it.
 *
 * The direction of the error is the point. Believing a context is required when
 * it is not means believing evidence gates a merge that does not gate it — the
 * fail-open direction, and the one a control plane must never guess at.
 *
 * Fetching is deliberately not here, matching `github.mjs`: callers reach GitHub
 * by different routes and none of them should be able to change the verdict.
 * This module decides from what they observed.
 */

/** The rule type that carries the required contexts. */
const REQUIRED_STATUS_CHECKS = 'required_status_checks'

/**
 * Pull the required contexts out of GitHub's effective-rules response for a
 * branch — `GET /repos/{owner}/{repo}/rules/branches/{branch}`.
 *
 * The effective-rules endpoint is used rather than a single ruleset because it
 * answers the question that matters: what applies to this branch, from every
 * ruleset at once. Reading one ruleset by id would miss an organisation-level
 * rule, and would go blind the day the repository ruleset is renumbered.
 *
 * More than one ruleset may contribute contexts, so they are unioned rather
 * than taken from the first rule found.
 *
 * @param {unknown} effectiveRules
 * @returns {{ readable: boolean, protected: boolean, contexts: string[], strict: boolean | null, rulesetIds: number[] }}
 */
export function extractRequiredContexts(effectiveRules) {
  if (!Array.isArray(effectiveRules)) {
    // Not "no contexts". An unreadable answer is the one case where reporting
    // an empty set would be actively dangerous: it reads exactly like a branch
    // with protection removed, and callers below fail closed on that.
    return { readable: false, protected: false, contexts: [], strict: null, rulesetIds: [] }
  }

  const rules = effectiveRules.filter(
    (rule) => rule && typeof rule === 'object' && rule.type === REQUIRED_STATUS_CHECKS,
  )
  if (rules.length === 0) {
    return { readable: true, protected: false, contexts: [], strict: null, rulesetIds: [] }
  }

  /** @type {Set<string>} */
  const contexts = new Set()
  /** @type {Set<number>} */
  const rulesetIds = new Set()
  let strict = false

  for (const rule of rules) {
    const parameters = rule.parameters ?? {}
    for (const check of parameters.required_status_checks ?? []) {
      if (check && typeof check.context === 'string' && check.context.length > 0) {
        contexts.add(check.context)
      }
    }
    if (parameters.strict_required_status_checks_policy === true) strict = true
    if (typeof rule.ruleset_id === 'number') rulesetIds.add(rule.ruleset_id)
  }

  return {
    readable: true,
    protected: true,
    contexts: [...contexts].sort(),
    strict,
    rulesetIds: [...rulesetIds].sort((a, b) => a - b),
  }
}

/**
 * Compare the live required set with the tracked record.
 *
 * Both directions are drift and neither is silently tolerated:
 *
 *   MISSING     the record expects a context the ruleset does not require. The
 *               repository believes a gate blocks merges and it does not. This
 *               is the fail-open direction and the reason the module exists.
 *
 *   UNDECLARED  the ruleset requires a context the record does not list. Merges
 *               are blocked by something the repository has not written down,
 *               so a gate can start blocking every pull request with no tracked
 *               explanation of what is expected to satisfy it.
 *
 * A context listed as requirable-but-not-required is NOT expected to be live.
 * It is carried so that promoting one reads as the recorded event it is rather
 * than as an unknown context appearing from nowhere.
 *
 * @param {{ effectiveRules: unknown, record: { required?: string[], requirableNotRequired?: Array<{ context: string }> } }} input
 */
export function evaluateRulesetDrift({ effectiveRules, record }) {
  const live = extractRequiredContexts(effectiveRules)
  const expected = [...(record.required ?? [])].sort()
  const requirable = new Set((record.requirableNotRequired ?? []).map((entry) => entry.context))

  if (!live.readable) {
    return {
      status: 'UNREADABLE',
      ok: false,
      reason: 'the hosted rules could not be read; an unread ruleset is not a verified one',
      expected,
      live: [],
      missing: expected,
      undeclared: [],
      promoted: [],
      strict: null,
      rulesetIds: [],
    }
  }

  if (!live.protected) {
    // Every expected context is reported missing rather than the rule simply
    // being called absent, because that is what it means for the merge queue:
    // nothing is gating main at all.
    return {
      status: 'PROTECTION_ABSENT',
      ok: false,
      reason: 'no required_status_checks rule applies to this branch; nothing gates a merge',
      expected,
      live: [],
      missing: expected,
      undeclared: [],
      promoted: [],
      strict: live.strict,
      rulesetIds: live.rulesetIds,
    }
  }

  const liveSet = new Set(live.contexts)
  const missing = expected.filter((context) => !liveSet.has(context))
  const extra = live.contexts.filter((context) => !expected.includes(context))
  const promoted = extra.filter((context) => requirable.has(context))
  const undeclared = extra.filter((context) => !requirable.has(context))

  const ok = missing.length === 0 && undeclared.length === 0 && promoted.length === 0
  return {
    status: ok ? 'MATCHED' : missing.length > 0 ? 'MISSING_REQUIRED' : 'UNDECLARED_REQUIRED',
    ok,
    reason: ok ? 'the hosted required set is exactly the tracked record' : null,
    expected,
    live: live.contexts,
    missing,
    undeclared,
    promoted,
    strict: live.strict,
    rulesetIds: live.rulesetIds,
  }
}

/**
 * The offline half: every context the record calls required must be published
 * by a tracked workflow job of exactly that name.
 *
 * This is checkable without a network and it catches the failure the hosted
 * check cannot see coming — a job renamed in a pull request. GitHub matches a
 * required context to a check run BY NAME, so renaming the job makes the
 * context stop posting, and a required context that never posts blocks every
 * pull request for ever. That is `DOC-001`, and it is a repository change that
 * a repository test can refuse.
 *
 * @param {{ required: string[], jobNames: string[] }} input
 */
export function findUnpublishedContexts({ required, jobNames }) {
  const published = new Set(jobNames)
  return required.filter((context) => !published.has(context))
}
