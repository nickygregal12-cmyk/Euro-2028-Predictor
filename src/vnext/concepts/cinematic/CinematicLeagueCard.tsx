import { useId } from 'react'
import { motion } from 'framer-motion'
import type { PrivateLeague } from '../../models/home'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import { formatNumber } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { RankMovementIndicator } from '../../components/game/RankMovementIndicator'
import styles from './cinematic.module.css'

export type CinematicLeagueCardProps = {
  league: PrivateLeague
}

/**
 * A private league, as a poster in the same rail as the rivals.
 *
 * It shows the window around the user rather than the table, for the reason the
 * workshop already found: "2 points to catch Jamie" only lands when Jamie's row
 * is visible next to yours. The user's row is marked with `aria-current`, an
 * accent edge and the word "You", because a tint alone reaches nobody who
 * cannot see it.
 */
export function CinematicLeagueCard({ league }: CinematicLeagueCardProps) {
  const headingId = useId()
  const lift = useVNextMotion(vnextMotion.liftAndPress)

  return (
    <motion.article
      className={styles.leaguePoster}
      aria-labelledby={headingId}
      variants={lift}
      initial="rest"
      whileHover="hover"
    >
      <p className={`${typography.label} ${styles.leagueEyebrow}`}>Private league</p>
      <h3 id={headingId} className={`${styles.leagueTitle} ${typography.clamp2}`}>
        {league.name}
      </h3>
      <p className={`${typography.micro} ${styles.leagueMeta}`}>
        {formatNumber(league.participantCount)} players
      </p>

      <ol className={styles.leagueRows}>
        {league.standings.map((standing) => (
          <li
            key={standing.player.id}
            className={`${styles.leagueRow} ${standing.isUser ? styles.leagueRowUser : ''}`}
            aria-current={standing.isUser ? 'true' : undefined}
          >
            <span className={`${styles.leagueRank} ${typography.numeric}`}>
              {standing.rank}
            </span>
            <span className={`${typography.body} ${typography.truncate}`}>
              {standing.isUser ? 'You' : standing.player.name}
            </span>
            <RankMovementIndicator
              movement={standing.movement}
              subject={standing.isUser ? 'You' : standing.player.name}
            />
            <span className={`${styles.leaguePoints} ${typography.numeric}`}>
              {formatNumber(standing.points)}
            </span>
          </li>
        ))}
      </ol>

      <p className={`${typography.caption} ${styles.leagueGapLine}`}>
        {league.gapToLeader === 0
          ? 'You lead it'
          : `${league.gapToLeader} ${
              league.gapToLeader === 1 ? 'point' : 'points'
            } to catch ${league.leaderName}`}
      </p>

      <motion.button
        type="button"
        className={styles.leagueAction}
        variants={lift}
        initial="rest"
        whileTap="tap"
        aria-label={`Open the full table for ${league.name}`}
      >
        Full table
      </motion.button>
    </motion.article>
  )
}
