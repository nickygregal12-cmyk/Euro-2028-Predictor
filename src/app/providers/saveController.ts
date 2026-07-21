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

export type SaveController = {
  /** Register a new value for a key; the machine decides when it actually saves. */
  change: (key: string, payload: unknown) => void
  /** Re-attempt a key stuck in the error state (user-triggered). */
  manualRetry: (key: string) => void
  /** Drop all per-key state + timers (e.g. when the active entry changes). */
  reset: () => void
  /** Stop the controller for good; ignores any late settling promises. */
  dispose: () => void
}

export function createSaveController(opts: {
  performSave: (key: string, payload: unknown) => Promise<void>
  onStatus: (key: string, status: SaveStatus) => void
}): SaveController {
  const states = new Map<string, SaveState<unknown>>()
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let disposed = false

  function clearRetry(key: string) {
    const t = retryTimers.get(key)
    if (t !== undefined) {
      clearTimeout(t)
      retryTimers.delete(key)
    }
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
            .catch(() => dispatch(key, { type: 'result', seq: effect.seq, ok: false }))
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
  }

  function clearAllTimers() {
    for (const t of retryTimers.values()) clearTimeout(t)
    retryTimers.clear()
  }

  return {
    change: (key, payload) => dispatch(key, { type: 'change', payload }),
    manualRetry: (key) => dispatch(key, { type: 'manualRetry' }),
    reset: () => {
      clearAllTimers()
      states.clear()
    },
    dispose: () => {
      disposed = true
      clearAllTimers()
      states.clear()
    },
  }
}
