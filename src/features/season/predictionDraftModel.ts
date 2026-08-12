import type { ScorelinePrediction } from '../../domain/season/scoring'
import type { PredictionDraft } from '../../services/offline/predictionDraftStore'
import type { PredictionBatchResult } from '../../services/supabase/seasonPredictionBatchModel'

/**
 * `INNOV-020` — what a draft is, and what the server's answer did to it.
 *
 * A DRAFT IS NEVER A SUBMISSION. Everything in this module describes work the
 * server has not accepted. There is exactly one transition into "the server has
 * it", and it is contract 177 answering `accepted`; nothing here can shortcut
 * it, and no state in the union below reads as submitted.
 *
 * A REFUSED DRAFT IS KEPT AND IS NOT RE-SENT. Deleting a player's unaccepted
 * work is the failure mode this feature exists to avoid, and silently retrying
 * a draft the server has already refused turns one clear answer into a loop
 * that never resolves. So a refusal is attached to the draft, the draft stops
 * being pending, and the surface offers the player the choice the refusal
 * implies.
 *
 * A CONFLICT IS A CHOICE AND IS PRESENTED AS ONE. Contract 177 returns both
 * scorelines — the stored one and the drafted one — precisely so this layer
 * does not have to pick. It does not pick.
 *
 * NO CLOCK, NO STORAGE, NO NETWORK. Every input is given.
 */

/** The server's refusal, attached to the draft it refused. */
export type DraftRefusal = {
  outcome: 'locked' | 'conflict' | 'invalid' | 'refused'
  /** The server's own sentence. Never replaced with a generic one. */
  reason: string | null
  /** Present on a conflict: what the server holds now. */
  stored: ScorelinePrediction | null
}

/**
 * What one fixture's local state is, in the player's terms.
 *
 * `submitted` is deliberately absent: a fixture with no draft is whatever the
 * card says it is, and inventing a "submitted" badge from the absence of a
 * draft would put a claim on screen this layer cannot make.
 */
export type DraftFixtureState = 'draft' | 'syncing' | 'locked' | 'conflict' | 'failed'

export type DraftFixtureView = {
  fixtureId: string
  state: DraftFixtureState
  /** The scoreline held on this device, or null where the draft clears one. */
  prediction: ScorelinePrediction | null
  refusal: DraftRefusal | null
}

export type DraftsView = {
  /** Every draft this device is holding, in fixture order as stored. */
  fixtures: readonly DraftFixtureView[]
  /** Drafts the next sync would send. */
  pending: number
  /** Drafts the server has refused and that need the player's decision. */
  blocked: number
  /** Whether a reconciliation is on the wire right now. */
  syncing: boolean
  /** The device believes it has no connection. Presentation only. */
  offline: boolean
  /** What the last reconciliation did, for one line of feedback. Null before one. */
  lastResult: { accepted: number; rejected: number } | null
}

/** A draft the server has not refused. Only these are ever sent. */
export function pendingDrafts(drafts: readonly PredictionDraft[]): readonly PredictionDraft[] {
  return drafts.filter((draft) => !draft.refusal)
}

export function draftState(draft: PredictionDraft, syncing: boolean): DraftFixtureState {
  if (draft.refusal) {
    switch (draft.refusal.outcome) {
      case 'locked':
        return 'locked'
      case 'conflict':
        return 'conflict'
      default:
        return 'failed'
    }
  }
  return syncing ? 'syncing' : 'draft'
}

export function presentDrafts(
  drafts: readonly PredictionDraft[],
  options: {
    syncing: boolean
    offline: boolean
    lastResult: { accepted: number; rejected: number } | null
  },
): DraftsView {
  const fixtures = drafts.map((draft) => ({
    fixtureId: draft.fixtureId,
    state: draftState(draft, options.syncing),
    prediction: draft.prediction,
    refusal: draft.refusal ?? null,
  }))

  return {
    fixtures,
    pending: fixtures.filter((fixture) => fixture.state === 'draft' || fixture.state === 'syncing')
      .length,
    blocked: fixtures.filter(
      (fixture) =>
        fixture.state === 'locked' || fixture.state === 'conflict' || fixture.state === 'failed',
    ).length,
    syncing: options.syncing,
    offline: options.offline,
    lastResult: options.lastResult,
  }
}

/**
 * Apply one reconciliation's answers to the drafts that were sent.
 *
 * ACCEPTED DRAFTS LEAVE. That is the only removal, and it happens because the
 * server said it has them.
 *
 * EVERY OTHER OUTCOME STAYS, CARRYING THE SERVER'S REASON. It stops being
 * pending, so the next sync does not send it again, and the surface has the
 * fact it needs to offer a choice.
 *
 * A DRAFT THE SERVER DID NOT MENTION IS UNTOUCHED. It was not in this batch, or
 * the answer was unreadable; either way its state has not changed and inventing
 * one would be a claim about a call that did not happen.
 */
export function applyBatchResult(
  drafts: readonly PredictionDraft[],
  result: PredictionBatchResult,
): readonly PredictionDraft[] {
  const answers = new Map(result.results.map((row) => [row.fixtureId, row]))

  return drafts.flatMap((draft) => {
    const answer = answers.get(draft.fixtureId)
    if (!answer) return [draft]
    if (answer.outcome === 'accepted') return []

    const stored =
      answer.outcome === 'conflict' &&
      answer.stored &&
      answer.stored.home !== null &&
      answer.stored.away !== null
        ? { home: answer.stored.home, away: answer.stored.away }
        : null

    return [
      {
        ...draft,
        refusal: { outcome: answer.outcome, reason: answer.reason, stored },
      },
    ]
  })
}

/** Replace one fixture's draft, or remove it. Order of the rest is preserved. */
export function upsertDraft(
  drafts: readonly PredictionDraft[],
  fixtureId: string,
  prediction: ScorelinePrediction | null,
): readonly PredictionDraft[] {
  const next: PredictionDraft = { fixtureId, prediction }
  const index = drafts.findIndex((draft) => draft.fixtureId === fixtureId)
  // A fresh edit clears any previous refusal: the player has answered it by
  // typing something else, and carrying the old reason forward would show a
  // conflict against a scoreline that no longer exists.
  if (index === -1) return [...drafts, next]
  return drafts.map((draft, at) => (at === index ? next : draft))
}

export function removeDraft(
  drafts: readonly PredictionDraft[],
  fixtureId: string,
): readonly PredictionDraft[] {
  return drafts.filter((draft) => draft.fixtureId !== fixtureId)
}

/** Clear a refusal so the next sync sends this draft again. */
export function retryDraft(
  drafts: readonly PredictionDraft[],
  fixtureId: string,
): readonly PredictionDraft[] {
  return drafts.map((draft) =>
    draft.fixtureId === fixtureId ? { fixtureId: draft.fixtureId, prediction: draft.prediction } : draft,
  )
}
