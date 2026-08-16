import { motion } from 'framer-motion'
import type { MatchClock, MatchStatus } from '../../models/football'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import typography from '../../foundations/typography.module.css'
import styles from './LiveIndicator.module.css'

export type LiveIndicatorProps = {
  status: MatchStatus
  clock: MatchClock | null
}

/**
 * The live state mark.
 *
 * The pulse is the one piece of continuous motion in the language, and it is
 * allowed because it means something: this number is still moving. Under
 * reduced motion the dot holds steady and the words carry the state instead —
 * "LIVE" and the minute are always written out, so the animation is emphasis
 * and never the message.
 *
 * `aria-live="off"` is deliberate. The minute changes constantly, and a polite
 * live region on it would talk over everything else a screen-reader user is
 * doing. Announcing score changes is a real design question and belongs to the
 * concept PRs, not to a decoration.
 */
export function LiveIndicator({ status, clock }: LiveIndicatorProps) {
  const pulse = useVNextMotion(vnextMotion.livePulse)
  if (status !== 'live' && status !== 'halfTime') return null

  const isInterval = status === 'halfTime'

  return (
    <span
      className={`${styles.indicator} ${typography.numeric}`}
      aria-live="off"
    >
      <motion.span
        className={styles.dot}
        variants={pulse}
        animate={isInterval ? undefined : 'rest'}
        aria-hidden="true"
      />
      <span className={styles.word}>{isInterval ? 'Half time' : 'Live'}</span>
      {clock ? <span className={styles.clock}>{clock.label}</span> : null}
    </span>
  )
}
