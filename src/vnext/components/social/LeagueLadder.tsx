import { useId } from 'react'
import { motion } from 'framer-motion'
import type { PrivateLeague } from '../../models/home'
import { formatNumber } from '../../foundations/format'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import surfaces from '../../foundations/surfaces.module.css'
import typography from '../../foundations/typography.module.css'
import { RankMovementIndicator } from '../game/RankMovementIndicator'
import styles from './LeagueLadder.module.css'

export type LeagueLadderProps = {
  league: PrivateLeague
  /** Optional action: open the full table. */
  onOpen?: (league: PrivateLeague) => void
}

/**
 * A private league, as the thing the game is actually about.
 *
 * Three deliberate choices:
 *
 * IT IS AN `<ol>`. The order is the meaning, and a screen reader announcing
 * "list, 4 items" then each rank in order is exactly right. A CSS-grid table
 * with hand-written ARIA would be more markup for a worse result at this size.
 *
 * IT SHOWS A WINDOW, NOT A TABLE. The rows around the user are what create the
 * pull — "2 points to catch Jamie" only lands next to Jamie's row.
 *
 * THE USER'S ROW IS MARKED TWICE. `aria-current` for assistive technology, plus
 * a visible accent bar and the word "you". A highlight alone would be invisible
 * to half the people reading it.
 */
export function LeagueLadder({ league, onOpen }: LeagueLadderProps) {
  const headingId = useId()
  const listVariants = useVNextMotion(vnextMotion.stagger)
  const rowVariants = useVNextMotion(vnextMotion.riseIn)

  return (
    <section
      className={`${surfaces.surface} ${styles.ladder}`}
      aria-labelledby={headingId}
    >
      <header className={styles.header}>
        <div className={styles.headingBlock}>
          <h2 id={headingId} className={`${typography.title} ${typography.clamp2}`}>
            {league.name}
          </h2>
          <p className={typography.micro}>
            {formatNumber(league.participantCount)} players
          </p>
        </div>
        <RankMovementIndicator movement={league.userMovement} />
      </header>

      <motion.ol
        className={styles.rows}
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
        {league.standings.map((standing) => (
          <motion.li
            key={standing.player.id}
            variants={rowVariants}
            className={`${styles.row} ${standing.isUser ? styles.userRow : ''}`}
            aria-current={standing.isUser ? 'true' : undefined}
          >
            <span className={`${styles.rank} ${typography.numeric}`}>
              {standing.rank}
            </span>
            <span className={styles.who}>
              <span className={styles.avatar} aria-hidden="true">
                {standing.player.initials}
              </span>
              <span className={`${typography.body} ${typography.clamp2}`}>
                {standing.isUser ? 'You' : standing.player.name}
              </span>
            </span>
            <RankMovementIndicator
              movement={standing.movement}
              subject={standing.isUser ? 'You' : standing.player.name}
            />
            <span className={`${styles.points} ${typography.numeric}`}>
              {formatNumber(standing.points)}
            </span>
          </motion.li>
        ))}
      </motion.ol>

      <footer className={styles.footer}>
        <p className={`${typography.caption} ${styles.gap}`}>
          {league.gapToLeader === 0
            ? `You lead ${league.name}`
            : `${league.gapToLeader} ${
                league.gapToLeader === 1 ? 'point' : 'points'
              } to catch ${league.leaderName}`}
        </p>
        {onOpen ? (
          <button
            type="button"
            className={styles.open}
            onClick={() => onOpen(league)}
            // Named for the league it opens, since several ladders can sit in
            // one column. An aria-label rather than hidden text: accessible-name
            // computation joins text nodes without a separator, which turns
            // "Full table" + " for X" into "Full tablefor X".
            aria-label={`Full table for ${league.name}`}
          >
            Full table
          </button>
        ) : null}
      </footer>
    </section>
  )
}
