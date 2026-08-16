import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import typography from '../../foundations/typography.module.css'
import styles from './cinematic.module.css'

export type CinematicRailProps = {
  /** Names the rail for assistive technology and heads it visually. */
  title: string
  meta?: ReactNode
  children: ReactNode
}

/**
 * A discovery rail, at this concept's proportions.
 *
 * WHY NOT `foundations/layout/Rail`. That primitive fixes its cards at 300/340
 * px because a fixture card is a fixture card at any width. Cinematic's cards
 * are posters that change shape between compositions, and forcing them through
 * a fixed width would have flattened exactly the variation this concept exists
 * to test. The ACCESSIBILITY contract is kept identical on purpose — a labelled
 * section, a focusable scroller (a scrollable region no keyboard user can reach
 * fails WCAG 2.1.1), a real list — because that part is not a design choice.
 *
 * Snapping is `proximity`, not `mandatory`: mandatory snapping fights a user
 * reading something halfway between two posters.
 */
export function CinematicRail({ title, meta, children }: CinematicRailProps) {
  const listVariants = useVNextMotion(vnextMotion.stagger)
  const itemVariants = useVNextMotion(vnextMotion.railItem)

  return (
    <section className={styles.rail} aria-label={title}>
      <header className={styles.railHead}>
        <h2 className={`${typography.title} ${styles.railTitle}`}>{title}</h2>
        {meta ? <p className={typography.caption}>{meta}</p> : null}
      </header>

      <div className={styles.railScroller} tabIndex={0}>
        <motion.ul
          className={styles.railList}
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {toArray(children).map((child, index) => (
            <motion.li
              key={index}
              className={styles.railItem}
              variants={itemVariants}
            >
              {child}
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}

/**
 * Children are flattened to an array so each one gets its own list item and its
 * own place in the stagger. The index is the key for the LIST WRAPPER only —
 * every child supplies its own stable key at the call site, and a rail's
 * contents are a fixed, ordered set rather than something that reorders.
 */
function toArray(children: ReactNode): ReactNode[] {
  return (Array.isArray(children) ? children : [children])
    .flat(2)
    .filter((child) => child !== null && child !== undefined && child !== false)
}
