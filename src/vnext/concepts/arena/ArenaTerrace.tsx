import type { HomeModel, Rival } from '../../models/home'
import { formatNumber, formatSignedPoints } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { RankMovementIndicator } from '../../components/game/RankMovementIndicator'
import styles from './arena.module.css'

export type ArenaTerraceProps = {
  model: HomeModel
}

/**
 * The terrace: who you are watching this with.
 *
 * Deliberately the SMALLEST social treatment of the three concepts, and
 * deliberately not a table. On a matchday the useful social fact is not the
 * standings — it is the gap: who you would pass, who would pass you, and by
 * how much. So each rival is a chip carrying one number and one sentence, and
 * the leagues are one line each rather than a ladder.
 *
 * It is a horizontal strip beneath the football until the desktop is wide
 * enough that a column beside the stage costs the football nothing.
 */
export function ArenaTerrace({ model }: ArenaTerraceProps) {
  return (
    <div className={styles.terraceBody}>
      <h2 className={`${typography.label} ${styles.terraceTitle}`}>The terrace</h2>

      <ul className={styles.terraceLeagues}>
        {model.privateLeagues.map((league) => (
          <li key={league.id} className={styles.terraceLeague}>
            <span className={`${typography.body} ${typography.truncate} ${styles.terraceLeagueName}`}>
              {league.name}
            </span>
            <span className={styles.terraceLeagueState}>
              <span className={`${styles.terraceRank} ${typography.numeric}`}>
                {league.userRank}
                <span className={styles.terraceRankOf}>
                  /{formatNumber(league.participantCount)}
                </span>
              </span>
              <RankMovementIndicator movement={league.userMovement} />
            </span>
            <span className={`${typography.micro} ${styles.terraceGap}`}>
              {league.gapToLeader === 0
                ? 'You lead it'
                : `${league.gapToLeader} behind ${league.leaderName}`}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.terraceScroller} tabIndex={0}>
        <ul className={styles.terraceRivals}>
          {model.rivals.map((rival) => (
            <li key={`${rival.player.id}-${rival.sharedLeagueName}`}>
              <RivalChip rival={rival} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function RivalChip({ rival }: { rival: Rival }) {
  const ahead = rival.pointsDifference > 0

  return (
    <article
      className={`${styles.rivalChip} ${ahead ? styles.rivalAhead : styles.rivalBehind}`}
      aria-label={`${rival.player.name}, ${describe(rival)}`}
    >
      <span className={styles.rivalInitials} aria-hidden="true">
        {rival.player.initials}
      </span>
      <span className={styles.rivalDetail}>
        <span className={`${typography.body} ${typography.truncate} ${styles.rivalName}`}>
          {rival.player.name}
        </span>
        <span className={`${typography.micro} ${styles.rivalLine}`}>
          {rival.headline ?? rival.sharedLeagueName}
        </span>
      </span>
      <span className={styles.rivalNumbers} aria-hidden="true">
        <span className={`${styles.rivalDelta} ${typography.numeric}`}>
          {formatSignedPoints(rival.pointsDifference)}
        </span>
        <RankMovementIndicator movement={rival.movement} subject={rival.player.name} />
      </span>
    </article>
  )
}

function describe(rival: Rival): string {
  const magnitude = Math.abs(rival.pointsDifference)
  const plural = magnitude === 1 ? 'point' : 'points'
  if (rival.pointsDifference > 0) return `${magnitude} ${plural} ahead of you`
  if (rival.pointsDifference < 0) return `${magnitude} ${plural} behind you`
  return 'level with you'
}
