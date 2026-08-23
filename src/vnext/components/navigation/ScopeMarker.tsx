import { motion } from 'framer-motion'
import {
  useReducedMotionPreference,
  useVNextMotion,
  useVNextTransition,
  vnextMotion,
  vnextTransition,
} from '../../foundations/motion'
import styles from './ScopeMarker.module.css'

export type ScopeMarkerProps = {
  /**
   * Ties the markers of ONE control together. Two segmented controls on the
   * same page must not share it, or the pill would fly across the screen
   * between them; `useId()` in the owning component is the usual source.
   */
  readonly group: string
}

/**
 * The pill behind the chosen option of a segmented control, travelling.
 *
 * ============================ WHY IT IS A COMPONENT AND NOT CSS ==========
 *
 * The pressed background used to be `[aria-pressed='true'] { background }`,
 * which is correct and instant: press the other option and the highlight is
 * simply somewhere else next frame. That reads as two separate things blinking
 * rather than as one selection MOVING, and a segmented control's whole job is
 * to say "this, of these" — the continuity is the meaning.
 *
 * ============================ IT IS THE NAVIGATION MARKER =================
 *
 * Deliberately the same motion as `VNextNav`'s indicator, resolved from the
 * same two presets rather than a third one invented here: a marker travelling
 * between siblings is one idea, and the vocabulary does not get a new entry for
 * every place it appears. Under reduced motion the shared `layoutId` is dropped
 * entirely so the pill is simply already in the right place — the same
 * treatment, for the same reason, as the navigation indicator.
 *
 * ============================ AND IT PAINTS BEHIND THE LABEL =============
 *
 * The marker is absolutely positioned, so the option's own text has to be
 * positioned too or the pill would paint over it. Every caller wraps its label
 * in an element that establishes that; `scopeMarker.test.tsx` holds the rule.
 */
export function ScopeMarker({ group }: ScopeMarkerProps) {
  const reduced = useReducedMotionPreference()
  const fade = useVNextMotion(vnextMotion.navIndicator)
  const travel = useVNextTransition(vnextTransition.navIndicator)

  return (
    <motion.span
      className={styles.marker}
      data-vnext-scope-marker=""
      aria-hidden="true"
      variants={fade}
      initial="hidden"
      animate="current"
      transition={travel}
      {...(reduced ? {} : { layoutId: `${group}-scope-marker` })}
    />
  )
}
