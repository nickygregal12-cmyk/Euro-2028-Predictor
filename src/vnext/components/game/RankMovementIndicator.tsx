import { motion } from 'framer-motion'
import type { RankMovement } from '../../models/home'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import typography from '../../foundations/typography.module.css'
import styles from './RankMovementIndicator.module.css'

export type RankMovementIndicatorProps = {
  /**
   * Null where nothing states how the subject moved. Different from
   * `{ direction: 'none' }`, which says they moved nowhere.
   */
  movement: RankMovement | null
  /** What moved, for the accessible sentence: "You", "Jamie", "Work League". */
  subject?: string
}

const GLYPH: Record<RankMovement['direction'], string> = {
  up: '▲',
  down: '▼',
  none: '–',
  new: '★',
}

/**
 * Rank movement, as a shape and a number before it is a colour.
 *
 * The triangle points the way the rank went, the number says how far, and the
 * accessible label is a sentence. Someone who cannot separate the green from
 * the red still reads "▲ 214"; someone using a screen reader hears "You moved
 * up 214 places".
 *
 * The nudge on entry is the smallest motion in the language and the first thing
 * reduced motion switches off — it is delight, not information.
 *
 * UNKNOWN MOVEMENT HOLDS ITS SPACE AND SAYS NOTHING. Real data made `movement`
 * nullable, and this component is called from four table rows and two headers
 * where it occupies a grid column. Returning nothing would collapse that column
 * and reflow the row, so a null renders an empty mark of the same size: the
 * ladder keeps its alignment and nobody is told they held their position. There
 * is no glyph and no sentence, because "–" is a claim and silence is not.
 */
export function RankMovementIndicator({
  movement,
  subject = 'You',
}: RankMovementIndicatorProps) {
  const variants = useVNextMotion(vnextMotion.rankMove)

  if (movement === null) {
    return <span className={`${styles.movement} ${styles.unknown}`} aria-hidden="true" />
  }

  const { direction, places } = movement
  const animateKey = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'flat'

  return (
    <span className={`${styles.movement} ${styles[direction]}`}>
      <motion.span
        className={styles.glyph}
        variants={variants}
        initial="flat"
        animate={animateKey}
        aria-hidden="true"
      >
        {GLYPH[direction]}
      </motion.span>
      {direction === 'up' || direction === 'down' ? (
        <span className={`${styles.places} ${typography.numeric}`} aria-hidden="true">
          {places}
        </span>
      ) : null}
      <span className={typography.srOnly}>{describe(subject, movement)}</span>
    </span>
  )
}

function describe(subject: string, movement: RankMovement): string {
  switch (movement.direction) {
    case 'up':
      return `${subject} moved up ${movement.places} ${plural(movement.places)}`
    case 'down':
      return `${subject} moved down ${movement.places} ${plural(movement.places)}`
    case 'new':
      // Past tense on purpose. The subject is "You" for the signed-in player
      // and a name for everybody else, so every sentence here has to be
      // grammatical with both — "You is new to this table" is what a verb that
      // agrees with only one of them produces.
      return `${subject} joined this table`
    default:
      return `${subject} did not move`
  }
}

function plural(places: number): string {
  return places === 1 ? 'place' : 'places'
}
