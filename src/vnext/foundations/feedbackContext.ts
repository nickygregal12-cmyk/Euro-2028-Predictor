import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import {
  emitFeedback,
  type FeedbackOutcome,
  type FeedbackPreference,
  type FeedbackSemantic,
} from './feedback'

/**
 * THE PLAYER'S HAPTIC PREFERENCE, RESOLVED ONCE AND READ WHERE IT IS NEEDED.
 *
 * ============================ WHY A CONTEXT ============================
 *
 * `feedback.ts` is a pure function of a semantic and a preference, which is
 * what makes the pattern table assertable without a device. But every surface
 * that wants to emit would then have to be handed the preference, and a
 * preference threaded through twenty components is a preference that gets
 * dropped on the way to one of them — which is indistinguishable, from the
 * player's side, from the setting not working.
 *
 * So `VNextRoot` provides it, exactly as it already provides the reduced-motion
 * override, and a component asks for an EMITTER rather than for the setting. A
 * component still cannot see the preference, which is deliberate: there is
 * nothing it could legitimately render from it.
 *
 * ============================ THE DEFAULT IS `system` ==================
 *
 * A surface rendered outside a `VNextRoot` — a story, a unit test, a component
 * gallery — gets the same answer an ordinary player who has never chosen gets.
 * Failing closed to `off` would make every test of an emitting surface pass for
 * the wrong reason.
 */
export const VNextFeedbackContext = createContext<FeedbackPreference>('system')

/** Emit the haptic half of a semantic state change. Returns what happened. */
export type FeedbackEmitter = (semantic: FeedbackSemantic) => FeedbackOutcome

/**
 * The emitter for this tree.
 *
 * IT IS THE ONLY WAY AN ACCEPTED SURFACE MAY VIBRATE ANYTHING, and
 * `tests/vnext/feedback.test.ts` holds that by refusing any `navigator.vibrate`
 * outside `feedback.ts`. A call site that wanted its own pattern would have to
 * add a semantic and argue for it, which is the friction the model exists for.
 */
export function useVNextFeedback(): FeedbackEmitter {
  const preference = useContext(VNextFeedbackContext)
  return useCallback(
    (semantic: FeedbackSemantic) => emitFeedback(semantic, { preference }),
    [preference],
  )
}

/**
 * EMIT ONCE EACH TIME SOMETHING BECOMES TRUE.
 *
 * ============================ WHY AN EDGE AND NOT A STATE ===============
 *
 * Every moment worth feeling is a TRANSITION — a pick landed, an invitation was
 * accepted, the last prediction went in. A surface that emitted while a
 * condition merely held would buzz on every re-render, and a surface that
 * emitted on mount would buzz at a player who arrived at a page where the thing
 * had already happened yesterday.
 *
 * So the first observation only ARMS this: a page that mounts with the
 * condition already true emits nothing, and the next false→true edge is the
 * first thing a player feels.
 *
 * ============================ IT RETURNS NOTHING ========================
 *
 * Deliberately, and for the same reason `emitFeedback` returns only an outcome:
 * a component that could render something from this would have made a haptic
 * load-bearing, and a device with no motor would then be missing information
 * rather than missing a flourish.
 */
export function useFeedbackOnLatch(active: boolean, semantic: FeedbackSemantic): void {
  const feedback = useVNextFeedback()
  const previous = useRef<boolean | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = active
    if (before === null) return
    if (!before && active) feedback(semantic)
  }, [active, semantic, feedback])
}
