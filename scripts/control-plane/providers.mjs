/**
 * Which provider may be reached, and whether it is worth reaching right now.
 *
 * WHAT THIS IS FOR. `classifyFailure` has told the difference between
 * `PROVIDER_LIMIT`, `PROVIDER_OUTAGE` and `AUTH_REQUIRED` since Loop Bootstrap,
 * and nothing has ever acted on that difference. A rate limit was retried
 * immediately, an outage was retried immediately, and a credential that will
 * never work was retried until the attempt limit blocked the task. Three
 * different problems, one behaviour.
 *
 * WHAT IT DELIBERATELY IS NOT. There is no model dispatch in this control
 * plane: every handler is a script. So the model lane in
 * `config/control-plane-providers.json` is declared and EMPTY, in the shape
 * Stage 3 used for the deployment identity lane — a lane that exists, is
 * provably unprovisioned, and can therefore hold nothing. Building a selection
 * layer over model providers that do not exist would be inventing a mechanism
 * for an absent thing; declaring the lane empty is the honest half, and it is
 * the half that makes the next provider arrive as a PROMOTION rather than as
 * something appearing from nowhere.
 *
 * THE FOUR REFUSALS ARE CODE, NOT DATA, for the same reason `ALWAYS_DENIED` is:
 * a refusal that lives in an editable record is one that can be edited away.
 *
 *   1. A PAID provider is never selected unless `paidUseAuthorised` is true.
 *      That flag is top-level, so adding a provider cannot enable billing —
 *      spending money takes two edits and the second is not about a provider.
 *   2. A FREE claim expires. A provider declared free must carry `freeUntil`,
 *      and past that instant the claim is unverified and the provider is not
 *      selectable. A free tier is a claim about a moment, not a property.
 *   3. `AUTH_REQUIRED` is not a retry. A credential that is refused now will be
 *      refused in thirty seconds; the provider is unusable until someone
 *      changes something outside this loop.
 *   4. Running out of healthy providers PARKS on `WAITING_PROVIDER`. It never
 *      falls back to a tier the record did not authorise, which is the failure
 *      mode "silently switched to paid billing" actually describes.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Billing tiers a provider may declare. Anything else is unusable. */
export const BILLING = Object.freeze(['INCLUDED', 'FREE', 'PAID'])

/** How long a provider rests after each kind of failure. */
export const COOLDOWN_MS = Object.freeze({
  PROVIDER_LIMIT: 15 * 60 * 1000,
  PROVIDER_OUTAGE: 5 * 60 * 1000,
  HOST_UNREACHABLE: 2 * 60 * 1000,
})

/** Failures that mean "not now". Anything not listed is not a provider fault. */
export const TRANSIENT = Object.freeze(Object.keys(COOLDOWN_MS))

export function readProviderRecord(path = 'config/control-plane-providers.json') {
  return JSON.parse(readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8'))
}

/**
 * May this provider be used at all, ignoring health?
 *
 * @param {any} provider
 * @param {{ paidUseAuthorised?: boolean, now: string }} context
 * @returns {{ permitted: boolean, reason: string | null }}
 */
export function permittedProvider(provider, { paidUseAuthorised = false, now }) {
  if (!provider?.id) return { permitted: false, reason: 'provider has no id' }
  if (!BILLING.includes(provider.billing)) {
    return { permitted: false, reason: `unknown billing tier ${JSON.stringify(provider.billing)}` }
  }

  if (provider.billing === 'PAID' && !paidUseAuthorised) {
    return { permitted: false, reason: `${provider.id} is PAID and paid use is not authorised` }
  }

  if (provider.billing === 'FREE') {
    if (!provider.freeUntil) {
      return { permitted: false, reason: `${provider.id} claims FREE with no freeUntil` }
    }
    const until = Date.parse(provider.freeUntil)
    if (Number.isNaN(until)) {
      return { permitted: false, reason: `${provider.id} has an unreadable freeUntil` }
    }
    if (Date.parse(now) >= until) {
      // Not an error and not a fallback to paying for it: the claim has simply
      // run out, and re-checking it is somebody's job rather than this loop's.
      return { permitted: false, reason: `${provider.id} was free until ${provider.freeUntil}; that claim has expired` }
    }
  }

  return { permitted: true, reason: null }
}

/**
 * @typedef {{ id: string, state: 'READY' | 'COOLING' | 'UNUSABLE',
 *   until?: string, reason?: string }} ProviderHealth
 */

/**
 * Fold one observed failure into a provider's health.
 *
 * Pure: it takes the health it was given and returns the health that follows,
 * so the caller decides where health is stored and this decides what it means.
 *
 * @param {ProviderHealth | undefined} health
 * @param {{ id: string, failureClass?: string | undefined, at: string }} observation
 * @returns {ProviderHealth}
 */
export function healthAfter(health, { id, failureClass, at }) {
  if (!failureClass) return { id, state: 'READY' }

  if (failureClass === 'AUTH_REQUIRED') {
    // Retrying a refused credential is the one case where waiting cannot help:
    // nothing about the next attempt is different.
    return { id, state: 'UNUSABLE', reason: 'AUTH_REQUIRED' }
  }

  const cooldown = /** @type {Record<string, number>} */ (COOLDOWN_MS)[failureClass]
  if (cooldown === undefined) {
    // Not a provider fault. A failing test says nothing about GitHub.
    return health ?? { id, state: 'READY' }
  }

  return {
    id,
    state: 'COOLING',
    until: new Date(Date.parse(at) + cooldown).toISOString(),
    reason: failureClass,
  }
}

/** @param {ProviderHealth | undefined} health @param {string} now */
export function isReady(health, now) {
  if (!health || health.state === 'READY') return true
  if (health.state === 'UNUSABLE') return false
  return Date.parse(now) >= Date.parse(health.until ?? now)
}

/**
 * Choose a provider for one lane, or say why there is none.
 *
 * Declaration order is the preference order: the record says which to try
 * first, and nothing here reorders it by cost, latency or guesswork. A
 * selection rule the record cannot see is a selection rule nobody can audit.
 *
 * @param {{ record?: any, lane: string, now: string,
 *           health?: Record<string, ProviderHealth>, requestsMade?: number }} input
 * @returns {{ selected: any | null, reason: string, rejected: Array<{ id: string, reason: string }> }}
 */
export function selectProvider({ record = readProviderRecord(), lane, now, health = {}, requestsMade = 0 }) {
  const budget = record?.budget?.maxRequestsPerRun
  if (typeof budget === 'number' && requestsMade >= budget) {
    // The ceiling is a stop, not a signal to find something else to spend.
    return { selected: null, reason: `run budget of ${budget} provider calls is spent`, rejected: [] }
  }

  const declared = record?.lanes?.[lane]
  if (!declared) return { selected: null, reason: `no lane ${JSON.stringify(lane)} in the provider record`, rejected: [] }

  const rejected = []
  for (const provider of declared.providers ?? []) {
    const permitted = permittedProvider(provider, {
      paidUseAuthorised: Boolean(record.paidUseAuthorised),
      now,
    })
    if (!permitted.permitted) {
      rejected.push({ id: provider.id ?? '(no id)', reason: /** @type {string} */ (permitted.reason) })
      continue
    }
    if (!isReady(health[provider.id], now)) {
      const state = health[provider.id]
      rejected.push({
        id: provider.id,
        reason: state?.state === 'UNUSABLE'
          ? `unusable: ${state.reason}`
          : `cooling after ${state?.reason} until ${state?.until}`,
      })
      continue
    }
    return { selected: provider, reason: `selected ${provider.id}`, rejected }
  }

  return {
    selected: null,
    reason: (declared.providers ?? []).length === 0
      ? `lane ${lane} is declared and unprovisioned`
      : `no provider in lane ${lane} is available`,
    rejected,
  }
}

/**
 * What the loop should do when a lane has nothing available.
 *
 * `WAITING_PROVIDER` rather than a failure: nothing is broken, the thing needed
 * is simply not reachable yet. It is an external wait like any other, so the
 * worker is released and the queue is rescanned — and crucially it is not a
 * cue to try a tier the record did not authorise.
 */
export const NO_PROVIDER_STATE = /** @type {import('./policy.mjs').TaskState} */ ('WAITING_PROVIDER')

// ---- DURABLE HEALTH -------------------------------------------------------
//
// Health lives on the run record rather than in memory, so a provider that was
// rate-limited before a restart is still rate-limited after one. It goes there
// rather than into a table of its own because `saveRun` already exists on both
// state backends: a new store method would have to be added to the file store,
// the ledger and the conformance suite to record something the run record can
// hold as it is.

/**
 * @param {import('./state.mjs').ControlPlaneState} store
 * @returns {Record<string, ProviderHealth>}
 */
export function providerHealth(store) {
  return store.loadRun()?.providerHealth ?? {}
}

/**
 * Fold one observation into durable health. Returns the new health for that id.
 *
 * @param {import('./state.mjs').ControlPlaneState} store
 * @param {{ id: string, failureClass?: string | undefined, at: string }} observation
 * @returns {ProviderHealth | null} null when there is no run to record against
 */
export function recordProviderObservation(store, { id, failureClass, at }) {
  const run = store.loadRun()
  if (!run) return null
  const health = { ...(run.providerHealth ?? {}) }
  const next = healthAfter(health[id], { id, failureClass, at })
  health[id] = next
  store.saveRun({ ...run, providerHealth: health })
  return next
}

/**
 * The provider to use for a lane right now, given durable health.
 *
 * @param {import('./state.mjs').ControlPlaneState} store
 * @param {{ lane: string, now: string, record?: any }} input
 */
export function availableProvider(store, { lane, now, record = readProviderRecord() }) {
  return selectProvider({ record, lane, now, health: providerHealth(store) })
}

/**
 * The handler result for "this lane has nothing available".
 *
 * A park, not a failure: nothing is broken and nothing here should go looking
 * for a tier the record did not authorise.
 *
 * @param {{ at: string, lane: string, reason: string,
 *           rejected?: Array<{ id: string, reason: string }> }} input
 * @returns {import('./loop.mjs').HandlerResult}
 */
export function parkedOnProvider({ at, lane, reason, rejected = [] }) {
  // The rejections belong in the evidence, not only in the checkpoint. "No
  // provider available" without saying which and why is the kind of message
  // that sends someone reading the log back to the source to find out.
  const why = rejected.map((entry) => `${entry.id}: ${entry.reason}`)

  return {
    ok: true,
    status: NO_PROVIDER_STATE,
    evidence: why.length > 0
      ? `no provider available for ${lane} — ${why.join('; ')}`
      : `no provider available for ${lane}: ${reason}`,
    nextAction: 'a provider in this lane becomes available, or one is added to the record',
    checkpoint: {
      at,
      lane,
      completed: 'provider selection',
      awaiting: 'an available provider',
      rejected: why,
    },
  }
}
