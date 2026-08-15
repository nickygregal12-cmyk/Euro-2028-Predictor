import { Link } from 'react-router'
import { ordinal } from '../league/ordinal'
import type { MatchweekRecap } from './matchweekRecapModel'
import styles from './MatchweekRecapCard.module.css'

export type MatchweekRecapCardProps = {
  recap: MatchweekRecap
}

function movementLabel(movement: number): string {
  if (movement > 0) return `Up ${movement}`
  if (movement < 0) return `Down ${Math.abs(movement)}`
  return 'No change'
}

/**
 * One settled matchweek, presented as performance information rather than a
 * sentence of numbers.
 *
 * The hierarchy follows the same rule as the Hub itself: what just happened is
 * first, season context is second, private-league consequence is third. Every
 * label stays visible so the card remains understandable without colour, and
 * every number is the authoritative value already supplied by the recap model.
 */
export function MatchweekRecapCard({ recap }: MatchweekRecapCardProps) {
  return (
    <Link className={styles.card} to={recap.href}>
      <span className={styles.topline}>
        <span className={styles.competition}>{recap.competitionName}</span>
        <span className={styles.matchweek}>{recap.matchweekLabel}</span>
      </span>

      <span className={styles.hero}>
        <span className={styles.pointsBlock}>
          <strong className={styles.points}>{recap.points}</strong>
          <span className={styles.pointsLabel}>Matchweek points</span>
        </span>
        {recap.jokerPlayed ? <span className={styles.joker}>Joker played</span> : null}
      </span>

      <dl className={styles.metrics}>
        {recap.seasonPoints !== null ? (
          <div className={styles.metric}>
            <dt>Season total</dt>
            <dd>{recap.seasonPoints} pts</dd>
          </div>
        ) : null}
        {recap.seasonRank !== null && recap.fieldSize !== null ? (
          <div className={styles.metric}>
            <dt>Season rank</dt>
            <dd>
              {ordinal(recap.seasonRank)} of {recap.fieldSize}
            </dd>
          </div>
        ) : null}
        {recap.exactScores !== null ? (
          <div className={styles.metric}>
            <dt>Season exact</dt>
            <dd>{recap.exactScores}</dd>
          </div>
        ) : null}
        {recap.correctOutcomes !== null ? (
          <div className={styles.metric}>
            <dt>Season correct</dt>
            <dd>{recap.correctOutcomes}</dd>
          </div>
        ) : null}
      </dl>

      {recap.leagues.length > 0 ? (
        <span className={styles.leagues}>
          <span className={styles.leaguesLabel}>Private league movement</span>
          {recap.leagues.map((league) => {
            const tone =
              league.movement > 0
                ? styles.movementUp
                : league.movement < 0
                  ? styles.movementDown
                  : styles.movementFlat
            return (
              <span className={styles.league} key={league.leagueId}>
                <span className={styles.leagueMain}>
                  <strong className={styles.leagueName}>{league.leagueName}</strong>
                  <span className={`${styles.movement} ${tone}`}>
                    {movementLabel(league.movement)}
                  </span>
                </span>
                <span className={styles.leagueMeta}>
                  {ordinal(league.rankBefore)} to {ordinal(league.rankAfter)} of {league.fieldSize}
                  {' · '}
                  {league.gapToLeaderAfter === 0
                    ? 'Leader'
                    : `${league.gapToLeaderAfter} pts off lead`}
                </span>
              </span>
            )
          })}
        </span>
      ) : null}
    </Link>
  )
}
