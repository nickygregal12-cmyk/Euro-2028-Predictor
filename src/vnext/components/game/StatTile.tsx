import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import surfaces from '../../foundations/surfaces.module.css'
import typography from '../../foundations/typography.module.css'
import styles from './StatTile.module.css'

export type StatTileTone = 'neutral' | 'accent' | 'live' | 'warn'

export type StatTileProps = {
  label: string
  value: ReactNode
  /** A qualifier under the number: "of 12,490", "on the pitch", "this week". */
  meta?: ReactNode
  /** Movement, a joker count, anything that belongs beside the number. */
  trailing?: ReactNode
  tone?: StatTileTone
  /**
   * Emphasise the number once, when it has just changed. Off by default: a tile
   * that pulses on every render is decoration pretending to be feedback.
   */
  emphasise?: boolean
}

/**
 * One number, said once, with its unit.
 *
 * The value uses tabular figures so a points total updating from 9 to 10 does
 * not shift the tile beside it, and the label is a real word rather than an
 * icon — "Rank", not a podium glyph nobody agrees on.
 */
export function StatTile({
  label,
  value,
  meta,
  trailing,
  tone = 'neutral',
  emphasise = false,
}: StatTileProps) {
  const variants = useVNextMotion(vnextMotion.pointsEmphasis)

  return (
    <div className={`${surfaces.surface} ${styles.tile} ${styles[tone]}`}>
      <span className={typography.label}>{label}</span>
      <span className={styles.valueRow}>
        <motion.span
          className={`${styles.value} ${typography.numeric}`}
          variants={variants}
          initial="rest"
          animate={emphasise ? 'changed' : 'rest'}
        >
          {value}
        </motion.span>
        {trailing}
      </span>
      {meta ? <span className={typography.micro}>{meta}</span> : null}
    </div>
  )
}
