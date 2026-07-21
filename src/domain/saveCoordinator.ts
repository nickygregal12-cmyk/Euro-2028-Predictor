// Pure save-ordering policy for autosave (client-side concurrency control).
//
// Every autosaved field (a match's score+joker row, the progression set, an
// award field, a tie-resolution) is a "key". Rapid edits + slow networks race:
// two writes for one key can be in flight at once, and the LAST response to
// land wins regardless of which carried newer data — so an older write can
// clobber a newer one, and a stale response can overwrite fresher status.
//
// This module is the pure state machine that prevents that. It holds no timers
// and does no I/O: it takes the current per-key state + an event and returns
// the next state plus EFFECTS for the caller to run (fire a save, schedule a
// retry, cancel a retry). The provider wires effects to real Supabase calls and
// setTimeout. Because the ordering logic is pure, it is unit-tested in full.
//
// Guarantees, per key:
//   * At most ONE save in flight at a time.
//   * Changes during a flight coalesce into a single latest-pending state;
//     intermediate states are never sent. When the flight settles, the latest
//     pending state saves next.
//   * A response is applied only if it belongs to the most recently ISSUED
//     request for that key (matched by seq). Stale responses — success or
//     failure — are ignored, so they never overwrite newer state.
//   * Failures retry automatically with backoff up to a bound, then surface an
//     error for manual retry. Local prediction state is never touched here —
//     this module only decides WHEN to save and what save-status to show.

// Structurally identical to the design-system SaveStatus union; kept local so
// the domain layer imports no React/component code.
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Automatic retries after the first failure, before surfacing a manual error. */
export const AUTO_RETRY_LIMIT = 2
export const RETRY_BASE_MS = 500
export const RETRY_FACTOR = 3
export const RETRY_MAX_MS = 5000

/** Backoff before the `attempt`-th retry (1-based). Grows geometrically, capped. */
export function backoffDelay(attempt: number): number {
  const raw = RETRY_BASE_MS * Math.pow(RETRY_FACTOR, Math.max(0, attempt - 1))
  return Math.min(raw, RETRY_MAX_MS)
}

/** One coalesced change: its issue sequence and the payload to persist. */
type Change<P> = { seq: number; payload: P }

export type SaveState<P> = {
  status: SaveStatus
  /** Monotonic per-key sequence; every change claims the next value. */
  nextSeq: number
  /** The change currently being saved or waiting to retry (null when settled). */
  active: Change<P> | null
  /** Whether `active` is on the wire right now (vs. waiting in backoff/error). */
  inFlight: boolean
  /** The newest change queued behind an in-flight `active` (only the latest). */
  pending: Change<P> | null
  /** Failed attempts for the current `active` payload. */
  attempt: number
}

export function initSaveState<P>(): SaveState<P> {
  return { status: 'idle', nextSeq: 1, active: null, inFlight: false, pending: null, attempt: 0 }
}

export type SaveEvent<P> =
  | { type: 'change'; payload: P }
  | { type: 'result'; seq: number; ok: boolean }
  | { type: 'retryTimer'; seq: number }
  | { type: 'manualRetry' }

export type SaveEffect<P> =
  | { type: 'save'; seq: number; payload: P }
  | { type: 'scheduleRetry'; seq: number; delayMs: number }
  | { type: 'cancelRetry' }

type Reduced<P> = { state: SaveState<P>; effects: SaveEffect<P>[] }

// Move a change into `active` and put it on the wire.
function issue<P>(state: SaveState<P>, change: Change<P>, cancelRetry = false): Reduced<P> {
  const effects: SaveEffect<P>[] = []
  if (cancelRetry) effects.push({ type: 'cancelRetry' })
  effects.push({ type: 'save', seq: change.seq, payload: change.payload })
  return {
    state: { ...state, active: change, inFlight: true, attempt: 0, status: 'saving' },
    effects,
  }
}

export function reduceSave<P>(state: SaveState<P>, event: SaveEvent<P>): Reduced<P> {
  switch (event.type) {
    case 'change': {
      const change: Change<P> = { seq: state.nextSeq, payload: event.payload }
      const base = { ...state, nextSeq: state.nextSeq + 1 }
      if (state.active === null) {
        // Nothing going on → save immediately.
        return issue(base, change)
      }
      if (state.inFlight) {
        // A save is on the wire → coalesce; keep only the latest pending change.
        return { state: { ...base, pending: change }, effects: [] }
      }
      // `active` is waiting to retry (backoff/error) → the newer change
      // supersedes it: cancel the pending retry and save the newer payload.
      return issue({ ...base, attempt: 0 }, change, true)
    }

    case 'result': {
      // Ignore any response that isn't the current in-flight request: a stale
      // success or failure must never overwrite newer state.
      if (state.active === null || !state.inFlight || event.seq !== state.active.seq) {
        return { state, effects: [] }
      }
      if (event.ok) {
        const settled: SaveState<P> = {
          ...state,
          status: 'saved',
          active: null,
          inFlight: false,
          attempt: 0,
        }
        if (state.pending) {
          return issue({ ...settled, pending: null }, state.pending)
        }
        return { state: settled, effects: [] }
      }
      // Failure. A newer change is waiting → abandon the failed payload and
      // save the newer one (don't waste retries writing stale data).
      if (state.pending) {
        return issue(
          { ...state, active: null, inFlight: false, attempt: 0, pending: null },
          state.pending,
        )
      }
      const attempt = state.attempt + 1
      if (attempt <= AUTO_RETRY_LIMIT) {
        // Auto-retry: stay in 'saving' (no new visual state) and schedule it.
        return {
          state: { ...state, inFlight: false, attempt, status: 'saving' },
          effects: [{ type: 'scheduleRetry', seq: state.active.seq, delayMs: backoffDelay(attempt) }],
        }
      }
      // Retries exhausted → surface an error; keep `active` for manual retry.
      return { state: { ...state, inFlight: false, attempt, status: 'error' }, effects: [] }
    }

    case 'retryTimer': {
      // Fire the scheduled retry, unless it was superseded/settled meanwhile.
      if (state.active === null || state.inFlight || event.seq !== state.active.seq) {
        return { state, effects: [] }
      }
      return {
        state: { ...state, inFlight: true, status: 'saving' },
        effects: [{ type: 'save', seq: state.active.seq, payload: state.active.payload }],
      }
    }

    case 'manualRetry': {
      // Re-arm from the error state (or a pending backoff). Reset the attempt
      // counter so the user gets a fresh round of automatic retries.
      if (state.active === null || state.inFlight) return { state, effects: [] }
      return {
        state: { ...state, inFlight: true, attempt: 0, status: 'saving' },
        effects: [
          { type: 'cancelRetry' },
          { type: 'save', seq: state.active.seq, payload: state.active.payload },
        ],
      }
    }
  }
}
