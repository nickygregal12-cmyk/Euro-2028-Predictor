/**
 * THE SEMANTIC INTERACTION-FEEDBACK MODEL. ADOPTED.
 *
 * THE PRINCIPLE BEING TESTED. Visual feedback, motion and optional haptic
 * feedback should describe the SAME semantic state change. A component says
 * what happened — a selection was made, something succeeded, something matters,
 * something is about to be lost — and this decides whether that becomes a
 * vibration. A component never says "vibrate for 30ms", because the moment it
 * does, the product has as many haptic vocabularies as it has components and no
 * way to turn any of them off.
 *
 * WHY IT IS NOT `navigator.vibrate()` AT THE CALL SITE. Four reasons, and the
 * brief names the first: scattered calls cannot be made optional, cannot be
 * made consistent, cannot be reasoned about ("does this product buzz too
 * much?" becomes a grep), and cannot be tested. One module can be all four.
 *
 * WHY IT NOW LIVES UNDER `foundations/`. It was written under `ia/` as a Stage
 * 7.5 PROPOSAL, with its own note saying that "if the principle survives review
 * it moves". It survived: the four semantics turned out to describe every
 * moment worth feeling in the finished product without a fifth, and the absence
 * of a `navigation` semantic turned out to be the load-bearing part. So it
 * moved, unchanged in substance — the same four semantics, the same patterns,
 * the same refusal to return a value a component could render.
 *
 * WHAT MOVING IT MEANS. `foundations/` is the accepted vNext language, so
 * accepted surfaces may now import it — through `useVNextFeedback` in
 * `VNextRoot`, which resolves the player's stored preference once rather than
 * threading it through every component.
 *
 * THE FOUR SEMANTICS, AND THE FIFTH THING THAT IS NOT ONE.
 *
 *   `selection`  a deliberate choice landed — a club picked, a competition
 *                switched to on purpose. The lightest mark there is.
 *   `success`    something completed — the last missing prediction, a private
 *                league joined, a Joker confirmed.
 *   `important`  a moment worth feeling — surviving a round, a rank moment.
 *   `warning`    something is about to be lost — a deadline inside the last few
 *                minutes with a decision still unmade.
 *
 * THERE IS DELIBERATELY NO `navigation` SEMANTIC. Ordinary navigation, opening
 * a card, scrolling and every button press are the bad uses the brief names, so
 * the vocabulary simply cannot express them: a developer who wants a buzz on a
 * tab change has to add a semantic to this file and argue for it in review,
 * which is exactly the friction that was missing.
 *
 * IT IS PROGRESSIVE ENHANCEMENT, WITHOUT EXCEPTION.
 *
 *   * a device with no vibration support is not a degraded experience, it is
 *     the normal one — every state change is already carried by a colour, a
 *     word and a shape, which is Stage 7's rule and not a new one;
 *   * `off` prevents emission entirely, and is the whole point of a preference
 *     existing before any surface uses it;
 *   * nothing here may be the only way to understand a state, so this module
 *     returns no value a component could render.
 *
 * REDUCED MOTION IS NOT WIRED TO IT, AND THAT IS A DELIBERATE OPEN QUESTION.
 * The brief says not to make reduced motion imply no haptics unless the product
 * research supports it, and this lane has no such research. A vestibular
 * preference and a preference about being buzzed are different preferences held
 * by different people for different reasons; guessing that they are the same
 * would silently remove a channel from a player who wanted it. So they are
 * independent here, and the question is reported rather than answered.
 */

export type FeedbackSemantic = 'selection' | 'success' | 'important' | 'warning'

/**
 * What the player has asked for.
 *
 * `system` means "not chosen", and it resolves to ON. That is a decision rather
 * than a default nobody made: a device with no vibration motor already answers
 * `unsupported`, a device with one has a system-level setting of its own that
 * `navigator.vibrate` already respects, and the four semantics below are
 * deliberately too sparse to be a nuisance. `off` exists for the player who
 * disagrees, and `src/app/providers/HapticsProvider.tsx` persists all three.
 *
 * REDUCED MOTION IS NOT WIRED TO IT — see the header. A vestibular preference
 * and a preference about being buzzed are different preferences.
 */
export type FeedbackPreference = 'system' | 'on' | 'off'

/**
 * What actually happened, so a test can assert the difference between "we chose
 * not to" and "the device cannot".
 */
export type FeedbackOutcome = 'emitted' | 'suppressed' | 'unsupported'

/**
 * The patterns, in milliseconds, as `navigator.vibrate` takes them.
 *
 * SHORT, AND DIFFERENT FROM EACH OTHER. A haptic vocabulary a player cannot
 * tell apart is one signal wearing four names, so `important` is a double tap
 * and `warning` a longer single pulse rather than all four being 20ms. None is
 * long enough to be felt as a buzz — the ceiling here is 90ms of contact, which
 * is under the duration of the shell's own base transition.
 */
const PATTERNS: Readonly<Record<FeedbackSemantic, readonly number[]>> = {
  selection: [10],
  success: [18],
  important: [14, 40, 14],
  warning: [45],
}

export type FeedbackEnvironment = {
  readonly preference?: FeedbackPreference
  /**
   * The vibrate implementation. Defaults to the platform's when there is one.
   * Injectable so a test can prove emission without a device, and so the module
   * itself has no direct dependency on a global.
   */
  readonly vibrate?: ((pattern: readonly number[]) => void) | null
}

/** The platform's vibrate, or null. Never throws, whatever the environment is. */
function platformVibrate(): ((pattern: readonly number[]) => void) | null {
  const nav: unknown = typeof navigator === 'undefined' ? null : navigator
  if (!nav || typeof nav !== 'object') return null
  const candidate = (nav as { vibrate?: unknown }).vibrate
  if (typeof candidate !== 'function') return null
  return (pattern) => {
    try {
      ;(candidate as (p: number[]) => unknown).call(nav, [...pattern])
    } catch {
      // A device that refuses is a device that does not have it. It cannot be
      // allowed to take a prediction down with it.
    }
  }
}

/**
 * Describe a semantic without emitting anything.
 *
 * PURE, AND THAT IS WHY IT IS SEPARATE. The pattern table is the part worth
 * asserting in a unit test, and a test that had to observe a side effect to
 * read it would be testing the browser instead.
 */
export function feedbackPattern(semantic: FeedbackSemantic): readonly number[] {
  return PATTERNS[semantic]
}

/**
 * Emit the haptic half of a state change, if the device and the player allow it.
 *
 * IT RETURNS AN OUTCOME AND NOTHING ELSE. There is no value here for a
 * component to render, because a component that rendered one would have made
 * the haptic load-bearing.
 */
export function emitFeedback(
  semantic: FeedbackSemantic,
  environment: FeedbackEnvironment = {},
): FeedbackOutcome {
  if (environment.preference === 'off') return 'suppressed'
  const vibrate =
    environment.vibrate === undefined ? platformVibrate() : environment.vibrate
  if (!vibrate) return 'unsupported'
  vibrate(PATTERNS[semantic])
  return 'emitted'
}
