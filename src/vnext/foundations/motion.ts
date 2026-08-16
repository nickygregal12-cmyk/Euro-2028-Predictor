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
 * The navigation indicator. The full path uses a shared `layoutId` so the
 * marker travels between items; the reduced path cross-fades in place, which is
 * why the two variants differ in opacity rather than position.
 */
export const navIndicator: MotionPreset = {
  full: {
    rest: { opacity: 1, transition: vnextSpring },
    reduced: { opacity: 1 },
  },
  reduced: {
    rest: { opacity: 1, transition: { duration: vnextDuration.fast } },
    reduced: { opacity: 1 },
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
  disclose,
  railItem,
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
