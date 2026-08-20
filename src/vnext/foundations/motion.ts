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
