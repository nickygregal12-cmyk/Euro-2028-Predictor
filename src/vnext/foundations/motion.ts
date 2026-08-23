/**
 * The vNext motion language.
 *
 * Small on purpose. Ten primitives, each tied to a job — entrance, list order,
 * hover depth, press, navigation indicator, live pulse, rank change, points
 * emphasis, disclosure, rail travel — and nothing that exists only to move.
 *
 * REDUCED MOTION IS BUILT IN, NOT BOLTED ON. Every preset is a pair: the full
 * variant and the reduced variant, resolved by `useVNextMotion()`. The reduced
 * variant is never "no feedback" — a state change still has to be visible — it
 * is the same change without travel, scale or pulsing. The CSS half of the same
 * language lives in `tokens.css`, so a hover transition is covered too.
 *
 * The numbers here are the same numbers as the `--vnext-duration-*` tokens.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import type { Transition, Variants } from 'framer-motion'

export const vnextDuration = {
  instant: 0.09,
  fast: 0.16,
  base: 0.26,
  slow: 0.42,
} as const

/** The single easing curve vNext uses for entrances and state changes. */
export const vnextEase = [0.32, 0.72, 0, 1] as const

export const vnextSpring = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.9,
} as const satisfies Transition

const instant: Transition = { duration: 0 }

export type MotionPreset = {
  readonly full: Variants
  readonly reduced: Variants
}

/** Content arriving: a short rise with the fade, or a plain fade when reduced. */
export const riseIn: MotionPreset = {
  full: {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: vnextDuration.base, ease: vnextEase },
    },
  },
  reduced: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: vnextDuration.fast } },
  },
}

/** A parent that deals its children out in order. Reduced shows them together. */
export const stagger: MotionPreset = {
  full: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
  },
  reduced: {
    hidden: {},
    visible: { transition: { staggerChildren: 0 } },
  },
}

/** A card lifting under the pointer, and pressing back under a finger. */
export const liftAndPress: MotionPreset = {
  full: {
    rest: { y: 0, scale: 1 },
    hover: { y: -4, scale: 1.01, transition: vnextSpring },
    tap: { y: 0, scale: 0.985, transition: { duration: vnextDuration.instant } },
  },
  reduced: {
    rest: { y: 0, scale: 1 },
    hover: { y: 0, scale: 1, transition: instant },
    tap: { y: 0, scale: 1, transition: instant },
  },
}

/**
 * The navigation indicator, appearing on the item that is now current.
 *
 * The marker's TRAVEL between items is a layout animation, which Framer drives
 * from the `transition` prop rather than from a variant, so the primitive ships
 * that half separately as `navIndicatorTravel` below. This half is the fade the
 * marker gets on arrival, and it is what makes the reduced path still show
 * which destination is current — the state is never dropped, only the movement.
 */
export const navIndicator: MotionPreset = {
  full: {
    hidden: { opacity: 0 },
    current: {
      opacity: 1,
      transition: { duration: vnextDuration.fast, ease: vnextEase },
    },
  },
  reduced: {
    hidden: { opacity: 0 },
    current: { opacity: 1, transition: { duration: vnextDuration.fast } },
  },
}

/** Live state. A slow breath, or a steady mark when reduced. */
export const livePulse: MotionPreset = {
  full: {
    rest: {
      opacity: [1, 0.45, 1],
      scale: [1, 0.86, 1],
      transition: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  reduced: {
    rest: { opacity: 1, scale: 1, transition: instant },
  },
}

/** Rank movement: the arrow nudges the way the rank went. */
export const rankMove: MotionPreset = {
  full: {
    up: {
      y: [6, -2, 0],
      opacity: [0, 1, 1],
      transition: { duration: vnextDuration.slow, ease: vnextEase },
    },
    down: {
      y: [-6, 2, 0],
      opacity: [0, 1, 1],
      transition: { duration: vnextDuration.slow, ease: vnextEase },
    },
    flat: { y: 0, opacity: 1, transition: instant },
  },
  reduced: {
    up: { y: 0, opacity: 1, transition: instant },
    down: { y: 0, opacity: 1, transition: instant },
    flat: { y: 0, opacity: 1, transition: instant },
  },
}

/**
 * ============================ AND WHY THERE IS NO DIGIT ODOMETER =========
 *
 * `@number-flow/react` was evaluated for this preset's job — a points total
 * rolling from 118 to 125 rather than pulsing — against the four conditions
 * the brief set, on 20 August 2026 at version 0.6.2. It fits the stack (React
 * 19 peer, no build change) and the bundle cost is affordable: wired into
 * `StatTile` and built, all JS moved 432.5 -> 438.1 KB gz, well inside the
 * 506 KB budget. It fails the other two.
 *
 * IT WOULD BE A SECOND NUMERIC FORMATTING AUTHORITY, which is the condition
 * that was named as disqualifying. The component takes a NUMBER and formats it
 * with its own `Intl.NumberFormat`, defaulting to the browser's locale —
 * while `format.ts` deliberately pins `en-GB` so a story, a jsdom test and a
 * CI screenshot are the same picture everywhere. Rendered beside each other on
 * a de-DE browser the two would disagree about the same figure: "1.428" in the
 * tile, "1,428" in the sentence under it. The pin could be threaded through,
 * but only by making every numeric call site pass a raw number plus format
 * options — 39 of them — so the fix IS the second authority, spelled out.
 *
 * AND IT CHANGES WHAT THE NUMBER IS. The measured output puts the figure in a
 * shadow root as `role="img"` with the value as its `aria-label`, and injects
 * a `<style>` element into the light DOM beside it. A rank that used to be
 * text becomes a picture of a rank; every assertion in this repository that
 * reads a stat region's `textContent` starts reading CSS.
 *
 * So: evaluated, measured, not adopted. `pointsEmphasis` stays, and the reason
 * is recorded here rather than in a document because this is where the next
 * person asking "should the numbers roll?" will be standing.
 */
/** A points figure changing. Emphasis, not celebration. */
export const pointsEmphasis: MotionPreset = {
  full: {
    rest: { scale: 1 },
    changed: {
      scale: [1, 1.14, 1],
      transition: { duration: vnextDuration.slow, ease: vnextEase },
    },
  },
  reduced: {
    rest: { scale: 1 },
    changed: { scale: 1, transition: instant },
  },
}

/**
 * A PREDICTION LANDING — the quietest thing in this vocabulary, on purpose.
 *
 * ============================ WHY IT IS NOT `pointsEmphasis` ============
 *
 * That preset is a number CHANGING, and it scales. A save landing changes no
 * number: the scoreline the player typed is already on the screen and was
 * already theirs. What changed is that the server now agrees, and the honest
 * shape for that is a small settle rather than a pop — the row arriving at
 * rest, not the row announcing something.
 *
 * ============================ AND IT FOLLOWS THE SERVER =================
 *
 * It plays on the transition INTO `saved`, which the save coordinator reports
 * when the write came back. Nothing here may play on a keystroke: a prediction
 * that animates as though it landed and then fails has told the player
 * something untrue, and the failure state is drawn in the same place.
 *
 * A card arriving with predictions already on it cannot trigger this, because
 * `saveStateOf` answers `idle` for a fixture nothing has saved this session.
 *
 * FILE-LOCAL, unlike its neighbours, and only because nothing imports it
 * directly: `vnextMotion.saveSettle` is the whole consumption path.
 */
const saveSettle: MotionPreset = {
  full: {
    rest: { opacity: 1, y: 0 },
    landed: {
      opacity: [0, 1],
      y: [3, 0],
      transition: { duration: vnextDuration.base, ease: vnextEase },
    },
  },
  reduced: {
    rest: { opacity: 1, y: 0 },
    landed: { opacity: 1, y: 0, transition: instant },
  },
}

/**
 * AN ACHIEVEMENT ARRIVING. The whole celebration vocabulary, and it is one
 * preset on purpose.
 *
 * ============================ WHY THERE IS ONLY ONE =====================
 *
 * A celebration vocabulary grows by being available: add a burst and a shimmer
 * and a sweep, and within a release something that is merely nice — a saved
 * prediction, a joined league — has borrowed the shape reserved for winning,
 * and then winning has nothing left. So this repository has exactly one, it is
 * for a mark the server says the player EARNED, and the second half of any
 * celebration is already in the vocabulary: the sentence beside the mark rises
 * in like every other sentence.
 *
 * ============================ WHAT IT IS NOT ============================
 *
 * Not confetti, not a full-screen overlay, not a sound, and not a repeat. It is
 * the mark landing slightly large and settling — about a third of a second,
 * once. A player who has just won a season-long game gets a beat of weight;
 * a player who reloads the page five minutes later gets the same picture
 * without the beat, because the achievement is a fact and the motion is only
 * how it arrived.
 *
 * ============================ AND REDUCED MOTION KEEPS THE MARK =========
 *
 * The reduced pair removes the scale and the travel and keeps the mark fully
 * opaque. That is the rule the whole foundation follows: under the preference a
 * primitive stops moving and never stops SAYING. A trophy that faded away for a
 * reduced-motion player would have taken the achievement with it.
 */
const achievementArrive: MotionPreset = {
  full: {
    rest: { opacity: 1, scale: 1 },
    earned: {
      opacity: [0, 1],
      scale: [0.7, 1.12, 1],
      transition: { duration: vnextDuration.slow, ease: vnextEase },
    },
  },
  reduced: {
    rest: { opacity: 1, scale: 1 },
    earned: { opacity: 1, scale: 1, transition: instant },
  },
}

/** Progressive disclosure. Height is animated; reduced simply appears. */
export const disclose: MotionPreset = {
  full: {
    collapsed: { height: 0, opacity: 0 },
    expanded: {
      height: 'auto',
      opacity: 1,
      transition: { duration: vnextDuration.base, ease: vnextEase },
    },
  },
  reduced: {
    collapsed: { height: 0, opacity: 0 },
    expanded: { height: 'auto', opacity: 1, transition: instant },
  },
}

/** Items entering a horizontal rail. */
export const railItem: MotionPreset = {
  full: {
    hidden: { opacity: 0, x: 24 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: vnextDuration.base, ease: vnextEase },
    },
  },
  reduced: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: vnextDuration.fast } },
  },
}

export const vnextMotion = {
  riseIn,
  stagger,
  liftAndPress,
  navIndicator,
  livePulse,
  rankMove,
  pointsEmphasis,
  saveSettle,
  achievementArrive,
  disclose,
  railItem,
} as const

/**
 * A transition that is not expressible as a variant.
 *
 * Layout animations (`layout`, `layoutId`) read the `transition` prop, not the
 * animating variant, so a component that needs one would otherwise have to
 * reach past the foundation and pick `vnextSpring` itself. Pairing it the same
 * way every preset is paired keeps the rule intact: components consume RESOLVED
 * motion, never a raw full-motion value.
 */
export type MotionTransitionPreset = {
  readonly full: Transition
  readonly reduced: Transition
}

/**
 * The navigation marker travelling from the old destination to the new one.
 * Reduced motion does not slow the journey down, it removes it: the marker is
 * simply already there, and the fade in `navIndicator` carries the state.
 */
export const navIndicatorTravel: MotionTransitionPreset = {
  full: vnextSpring,
  reduced: instant,
}

export const vnextTransition = {
  navIndicator: navIndicatorTravel,
} as const

/**
 * ============================ SHARED-ELEMENT CONTINUITY, EVALUATED =======
 *
 * The programme asked whether a shared element should carry the eye across six
 * journeys: fixture row -> Match Centre, player row -> Player Profile, game
 * card -> game screen, league row -> league detail, competition switch, and
 * filter/scope change. The answer splits cleanly on one line, and the line is
 * not aesthetic.
 *
 * FIVE OF THE SIX CROSS A ROUTE, AND A ROUTE UNMOUNTS. Framer's `layoutId`
 * measures one element against another that is mounted AT THE SAME MOMENT.
 * Every vNext destination is a separate `lazy()` chunk behind react-router, so
 * at the instant the Match Centre mounts, the fixture list is already gone —
 * there is nothing to travel from. Making it work means holding the outgoing
 * route mounted through an exit animation and keeping both chunks resident:
 * `AnimatePresence` around the route tree, an exit state for every destination,
 * and the code-splitting boundary softened. That is the shell's architecture,
 * and rebuilding the accepted shell to add a flourish is exactly what this
 * programme's scope boundaries forbid. Recorded, with the reason, so the next
 * session meets the constraint rather than discovering it.
 *
 * THE SIXTH DOES NOT CROSS ANYTHING, so it is done. A scope or filter change
 * happens inside one mounted surface, which is where a shared element is cheap
 * and truthful — see `components/navigation/ScopeMarker`, on Matches and on
 * Leagues, reusing this very transition rather than inventing a second one.
 * A selection that MOVES says "this, of these"; a background that reappears
 * somewhere else says "something changed, find it".
 */

/**
 * Workshop override for the reduced-motion preference.
 *
 * `null` means "ask the operating system", which is the production behaviour.
 * The workshop sets `true`/`false` so a reviewer can compare both paths without
 * changing a system setting — the one place an override is legitimate.
 */
export const VNextReducedMotionContext = createContext<boolean | null>(null)

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Whether motion should be reduced, honouring the workshop override first. */
export function useReducedMotionPreference(): boolean {
  const override = useContext(VNextReducedMotionContext)
  const [systemPreference, setSystemPreference] = useState(
    systemPrefersReducedMotion,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const handleChange = () => setSystemPreference(query.matches)
    handleChange()
    // `addEventListener` on MediaQueryList is the modern API; jsdom and every
    // supported browser have it, so no legacy `addListener` fallback is kept.
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return override ?? systemPreference
}

/**
 * Resolve a preset to the variants this user should get.
 *
 * Call sites read as `const variants = useVNextMotion(vnextMotion.riseIn)`,
 * which makes forgetting the reduced path a visible omission rather than a
 * silent one.
 */
export function useVNextMotion(preset: MotionPreset): Variants {
  return useReducedMotionPreference() ? preset.reduced : preset.full
}

/**
 * The same resolution for a bare transition, so a layout animation is chosen by
 * the foundation rather than by the component that happens to need one.
 */
export function useVNextTransition(preset: MotionTransitionPreset): Transition {
  return useReducedMotionPreference() ? preset.reduced : preset.full
}
