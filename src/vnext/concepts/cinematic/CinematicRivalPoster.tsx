import { useId } from 'react'
import { motion } from 'framer-motion'
import type { Rival } from '../../models/home'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import { formatNumber, formatOrdinal } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { RankMovementIndicator } from '../../components/game/RankMovementIndicator'
import styles from './cinematic.module.css'

export type CinematicRivalPosterProps = {
  rival: Rival
}

/**
 * A rival, given the same treatment as a match.
 *
 * This is the concept's strongest claim: that in a prediction game a person you
 * are two points behind is as worth a poster as a fixture is. So the rivalries
 * rail is composed of the SAME shape as the football rails rather than being a
 * list bolted underneath them, and the gap gets the display-size number.
 *
 * The direction is stated three ways — the word, the sign and the edge colour —
 * so it never depends on the colour alone.
 */
export function CinematicRivalPoster({ rival }: CinematicRivalPosterProps) {
  const headingId = useId()
  const lift = useVNextMotion(vnextMotion.liftAndPress)
  const ahead = rival.pointsDifference > 0
  const magnitude = Math.abs(rival.pointsDifference)

  return (
    <motion.article
      className={`${styles.rivalPoster} ${ahead ? styles.rivalChasing : styles.rivalDefending}`}
      aria-labelledby={headingId}
      variants={lift}
      initial="rest"
      whileHover="hover"
    >
      <div className={styles.rivalTop}>
        <span className={styles.rivalAvatar} aria-hidden="true">
          {rival.player.initials}
        </span>
        <RankMovementIndicator movement={rival.movement} subject={rival.player.name} />
      </div>

      <h3 id={headingId} className={`${styles.rivalName} ${typography.clamp2}`}>
        {rival.player.name}
      </h3>

      <p className={`${styles.rivalGap} ${typography.numeric}`}>
        <span className={styles.rivalGapValue}>{magnitude}</span>
        <span className={styles.rivalGapUnit}>
          {magnitude === 1 ? 'point' : 'points'} {ahead ? 'ahead of you' : 'behind you'}
        </span>
      </p>

      <p className={`${typography.caption} ${styles.rivalHeadline}`}>
        {rival.headline ?? `${formatOrdinal(rival.rank)} in ${rival.sharedLeagueName}`}
      </p>

      <p className={`${typography.micro} ${styles.rivalMeta}`}>
        {formatNumber(rival.points)} pts · {rival.sharedLeagueName}
      </p>

      <motion.button
        type="button"
        className={styles.rivalAction}
        variants={lift}
        initial="rest"
        whileTap="tap"
        aria-label={`Compare your predictions with ${rival.player.name}`}
      >
        Compare
      </motion.button>
    </motion.article>
  )
}
