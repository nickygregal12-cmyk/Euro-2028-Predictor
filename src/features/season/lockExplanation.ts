import type { LockStateReason, ResolvedLockState } from '../../domain/competition/lockState'

/**
 * User-facing copy for an authoritative lock decision.
 *
 * `resolveLockState` returns a machine reason and nothing a player can read.
 * Until now that was survivable, because the only surface consuming a
 * matchweek-scoped lock was the DEV preview, which prints the raw enum. A
 * player-facing matchweek card cannot do that, and the modernisation plan's
 * §13.4 makes "authoritative lock explanation" a release gate rather than a
 * nicety.
 *
 * THE DISTINCTION THIS LAYER EXISTS TO KEEP. Three of the eight reasons are not
 * a deadline at all — `missing_fixture_data`, `stale_fixture_data` and
 * `invalid_fixture_data` mean the lock arithmetic could not be trusted, so it
 * failed closed. Telling a player "predictions are closed" in that case is a
 * lie of omission: nothing closed, we could not work out whether it had. They
 * get an honest unavailable state instead, and the difference is carried in the
 * type rather than left to whichever component renders it.
 *
 * Copy only. It cannot change whether something is locked — `locked` comes from
 * the domain and this module never recomputes it.
 */

/**
 * Why the surface is in the state it is in, from the player's point of view.
 *
 * - `open` — predictions are editable.
 * - `closed` — the deadline passed. A real, explainable competitive state.
 * - `unavailable` — the lock could not be resolved, so the surface fails
 *   closed and says so. Not a deadline.
 */
export type LockPresentationKind = 'open' | 'closed' | 'unavailable'

export type LockExplanation = {
  kind: LockPresentationKind
  /** Short label for a badge or chip. */
  label: string
  /** One sentence a player can act on. */
  detail: string
  /**
   * Whether a retry could plausibly change the answer. True only for the
   * fail-closed cases: a deadline does not un-pass because someone reloaded.
   */
  retryable: boolean
}

const EXPLANATIONS: Record<LockStateReason, LockExplanation> = {
  before_scope_lock: {
    kind: 'open',
    label: 'Open',
    detail: 'Your predictions for this matchweek are saved as you enter them.',
    retryable: false,
  },
  scope_lock_reached: {
    kind: 'closed',
    label: 'Locked',
    detail: 'This matchweek locked at its first kickoff. Your saved predictions stand.',
    retryable: false,
  },
  match_kickoff_reached: {
    kind: 'closed',
    label: 'Locked',
    detail: 'This match has kicked off, so its prediction is final.',
    retryable: false,
  },
  already_locked: {
    kind: 'closed',
    label: 'Locked',
    detail: 'This matchweek is closed and does not reopen.',
    retryable: false,
  },
  missing_fixture_data: {
    kind: 'unavailable',
    label: 'Unavailable',
    detail:
      'We cannot confirm this matchweek’s deadline yet, so it is closed for now rather than guessed at.',
    retryable: true,
  },
  stale_fixture_data: {
    kind: 'unavailable',
    label: 'Unavailable',
    detail:
      'The fixture list for this matchweek is out of date, so it is closed until we can confirm the deadline.',
    retryable: true,
  },
  invalid_fixture_data: {
    kind: 'unavailable',
    label: 'Unavailable',
    detail:
      'This matchweek’s fixture data does not make sense, so it is closed rather than accepting predictions we could not score.',
    retryable: true,
  },
  invalid_time: {
    kind: 'unavailable',
    label: 'Unavailable',
    detail: 'We could not read the current time reliably, so this matchweek is closed for now.',
    retryable: true,
  },
}

/**
 * Explain a resolved lock.
 *
 * The domain's `locked` flag wins over the reason's usual presentation: a
 * reason that normally reads as open cannot present as open on a scope the
 * domain has locked. That ordering matters because `resolveLockState` is the
 * authority and this module is copy — if the two ever disagree, the copy is
 * what is wrong.
 */
export function explainLock(lock: ResolvedLockState): LockExplanation {
  const explanation = EXPLANATIONS[lock.reason]
  if (lock.locked && explanation.kind === 'open') {
    return {
      kind: 'closed',
      label: 'Locked',
      detail: 'This matchweek is closed.',
      retryable: false,
    }
  }
  if (!lock.locked && explanation.kind !== 'open') {
    // The mirror case. An unlocked scope carrying a fail-closed reason would be
    // a domain contradiction; presenting it as open is the safe read, and the
    // domain's own tests are where such a contradiction should be caught.
    return EXPLANATIONS.before_scope_lock
  }
  return explanation
}
