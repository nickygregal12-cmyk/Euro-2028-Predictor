import type { Match } from '../../models/football'
import { formatKickoffLabel } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import styles from './arena.module.css'

export type ArenaTickerProps = {
  matches: readonly Match[]
  now: string
}

/**
 * The score bar.
 *
 * Every match in the matchday, at a glance, in the order a broadcast would put
 * them: what is on now, what is coming, what has finished. It is the reason
 * this concept can give one match a whole stage without hiding the other four
 * — the answer to "what else is happening" is on the first screen, one row
 * tall, at every width.
 *
 * It is a list rather than a marquee. Continuous horizontal travel is motion
 * with no job, it cannot be read at a glance, and it is the first thing a
 * reduced-motion user would have to fight. Scrolling is the user's.
 */
export function ArenaTicker({ matches, now }: ArenaTickerProps) {
  return (
    <section
      className={styles.ticker}
      aria-label="Matchday scores"
      data-vnext-zone="scores"
    >
      <div className={styles.tickerScroller} tabIndex={0}>
        <ul className={styles.tickerList}>
          {matches.map((match) => {
            const inPlay = match.status === 'live' || match.status === 'halfTime'
            return (
              <li
                key={match.id}
                className={`${styles.tickerItem} ${inPlay ? styles.tickerLive : ''}`}
              >
                <span className={`${styles.tickerState} ${typography.numeric}`}>
                  {stateLabel(match, now)}
                </span>
                <span className={styles.tickerTeams}>
                  <span className={`${styles.tickerTeam} ${typography.numeric}`}>
                    {match.home.team.abbreviation}
                    <span className={styles.tickerGoals}>
                      {match.score ? match.score.home : '–'}
                    </span>
                  </span>
                  <span className={`${styles.tickerTeam} ${typography.numeric}`}>
                    {match.away.team.abbreviation}
                    <span className={styles.tickerGoals}>
                      {match.score ? match.score.away : '–'}
                    </span>
                  </span>
                </span>
                <span className={typography.srOnly}>
                  {match.home.team.name} versus {match.away.team.name},{' '}
                  {match.score
                    ? `${match.score.home}–${match.score.away}`
                    : 'not started'}
                  {match.prediction
                    ? `, your call ${match.prediction.score.home}–${match.prediction.score.away}`
                    : ', not predicted'}
                </span>
                <span
                  className={`${styles.tickerCall} ${
                    match.prediction ? '' : styles.tickerCallOpen
                  } ${typography.numeric}`}
                  aria-hidden="true"
                >
                  {match.prediction
                    ? `${match.prediction.score.home}–${match.prediction.score.away}`
                    : '– –'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function stateLabel(match: Match, now: string): string {
  switch (match.status) {
    case 'live':
      return match.clock?.label ?? 'Live'
    case 'halfTime':
      return 'HT'
    case 'fullTime':
      return 'FT'
    case 'postponed':
      return 'P–P'
    default:
      // Tomorrow's fixture must not read as another 12:00 kick-off today, so
      // the day comes from the model instant rather than from the clock.
      return formatKickoffLabel(match.kickoff, now).replace('Today ', '')
  }
}
