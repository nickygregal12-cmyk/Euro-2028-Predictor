// Thin, impure runner around the pure save-ordering machine
// (domain/saveCoordinator). It owns the side effects the reducer only DESCRIBES:
// firing the real Supabase save, running backoff timers, and pushing each key's
// save-status back to the UI. All ordering decisions live in the pure reducer;
// this file just executes its effects. One controller instance serves every
// autosave key (matches, ties, bracket, golden boot), routed by key string.

import {
  initSaveState,
  reduceSave,
  type SaveState,
  type SaveEvent,
  type SaveStatus,
} from '../../domain/saveCoordinator'

export type SaveBarrierResult = {
  ok: boolean
  cancelled: boolean
  errorKeys: string[]
  conflictKeys: string[]
}

export type SaveController = {
  /** Register a new value for a key; the machine decides when it actually saves. */
  change: (key: string, payload: unknown) => void
  /** Re-attempt a key stuck in the error state (user-triggered). */
  manualRetry: (key: string) => void
  /** Resolve once every queued/in-flight/retrying key reaches a terminal state. */
  waitForSettled: () => Promise<SaveBarrierResult>
  /** Drop all per-key state + timers (e.g. when the active entry changes). */
  reset: () => void
  /** Stop the controller for good; ignores any late settling promises. */
  dispose: () => void
}

export function createSaveController(opts: {
  performSave: (key: string, payload: unknown) => Promise<void>
  onStatus: (key: string, status: SaveStatus) => void
  // Classify a rejected save. A version conflict is terminal + non-retryable
  // (the server row changed elsewhere); everything else auto-retries. Defaults
  // to "never a conflict" so callers that don't care keep the old behaviour.
  isConflict?: (err: unknown) => boolean
}): SaveController {
  const isConflict = opts.isConflict ?? (() => false)
  const states = new Map<string, SaveState<unknown>>()
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const barrierWaiters = new Set<(result: SaveBarrierResult) => void>()
  let disposed = false

  function clearRetry(key: string) {
    const t = retryTimers.get(key)
    if (t !== undefined) {
      clearTimeout(t)
      retryTimers.delete(key)
    }
  }

  function currentBarrierResult(): SaveBarrierResult | null {
    const errorKeys: string[] = []
    const conflictKeys: string[] = []

    for (const [key, state] of states) {
      const unsettled =
        state.inFlight ||
        state.pending !== null ||
        (state.active !== null && state.status === 'saving')
      if (unsettled) return null
      if (state.status === 'error') errorKeys.push(key)
      if (state.status === 'conflict') conflictKeys.push(key)
    }

    errorKeys.sort()
    conflictKeys.sort()
    return {
      ok: errorKeys.length === 0 && conflictKeys.length === 0,
      cancelled: false,
      errorKeys,
      conflictKeys,
    }
  }

  function resolveBarrierWaitersIfSettled() {
    if (barrierWaiters.size === 0) return
    const result = currentBarrierResult()
    if (result === null) return
    const waiters = [...barrierWaiters]
    barrierWaiters.clear()
    for (const resolve of waiters) resolve(result)
  }

  function cancelBarrierWaiters() {
    if (barrierWaiters.size === 0) return
    const result: SaveBarrierResult = {
      ok: false,
      cancelled: true,
      errorKeys: [],
      conflictKeys: [],
    }
    const waiters = [...barrierWaiters]
    barrierWaiters.clear()
    for (const resolve of waiters) resolve(result)
  }

  function dispatch(key: string, event: SaveEvent<unknown>) {
    if (disposed) return
    const prev = states.get(key) ?? initSaveState<unknown>()
    const { state, effects } = reduceSave(prev, event)
    states.set(key, state)
    if (state.status !== prev.status) opts.onStatus(key, state.status)
    for (const effect of effects) {
      switch (effect.type) {
        case 'save':
          opts
            .performSave(key, effect.payload)
            .then(() => dispatch(key, { type: 'result', seq: effect.seq, ok: true }))
            .catch((err) =>
              dispatch(key, {
                type: 'result',
                seq: effect.seq,
                ok: false,
                conflict: isConflict(err),
              }),
            )
          break
        case 'scheduleRetry':
          clearRetry(key)
          retryTimers.set(
            key,
            setTimeout(() => {
              retryTimers.delete(key)
              dispatch(key, { type: 'retryTimer', seq: effect.seq })
            }, effect.delayMs),
          )
          break
        case 'cancelRetry':
          clearRetry(key)
          break
      }
    }
    resolveBarrierWaitersIfSettled()
  }

  function clearAllTimers() {
    for (const t of retryTimers.values()) clearTimeout(t)
    retryTimers.clear()
  }

  return {
    change: (key, payload) => dispatch(key, { type: 'change', payload }),
    manualRetry: (key) => dispatch(key, { type: 'manualRetry' }),
    waitForSettled: () => {
      if (disposed) {
        return Promise.resolve({
          ok: false,
          cancelled: true,
          errorKeys: [],
          conflictKeys: [],
        })
      }
      const settled = currentBarrierResult()
      if (settled !== null) return Promise.resolve(settled)
      return new Promise<SaveBarrierResult>((resolve) => barrierWaiters.add(resolve))
    },
    reset: () => {
      cancelBarrierWaiters()
      clearAllTimers()
      states.clear()
    },
    dispose: () => {
      disposed = true
      cancelBarrierWaiters()
      clearAllTimers()
      states.clear()
    },
  }
}
