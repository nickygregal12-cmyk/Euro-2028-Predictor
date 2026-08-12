import { useId } from 'react'
import type { SideHonours } from './sideHonoursModel'
import styles from './SeasonLeagueHonours.module.css'

/**
 * `INNOV-012` on screen — a league's side honours for one settled matchweek.
 *
 * IT SITS BELOW THE MATCHWEEK IT DESCRIBES AND NEVER BESIDE THE TABLE. The
 * table is the competition; these are the consolations, and putting them next
 * to a ranking is how a decoration starts reading like a result.
 *
 * EVERY AWARD SHOWS ITS RULE. The definition is a disclosure beside the award
 * rather than a separate help page, because an award a player has to go
 * somewhere else to understand is one they will not trust.
 *
 * A SHARED HONOUR NAMES EVERYBODY. Two players level are both winners, and the
 * copy says shared — inventing a tie-break to produce one name would be a rule
 * nobody published.
 *
 * NOTHING HERE IS A RANKING. There are no positions, no order of merit and no
 * negative award.
 */

export type SeasonLeagueHonoursProps = {
  honours: SideHonours
}

export function SeasonLeagueHonours({ honours }: SeasonLeagueHonoursProps) {
  const headingId = useId()

  // An unsettled matchweek has nothing to award. Saying so would put an empty
  // trophy cabinet under every matchweek in progress.
  if (!honours.settled || honours.honours.length === 0) return null

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h3 className={styles.heading} id={headingId}>
        {honours.matchweekLabel} honours
      </h3>
      <p className={styles.note}>
        Side honours. They change no points and no league position.
        {honours.truncated
          ? ` Measured over the ${honours.measured} members this league returned, which is not all of them.`
          : ''}
      </p>

      <ul className={styles.awards}>
        {honours.honours.map((honour) => (
          <li className={styles.award} key={honour.key}>
            <span className={styles.awardTitle}>{honour.title}</span>
            <span className={styles.awardWinners}>
              {honour.winners.map((winner) => winner.displayName).join(', ')}
              {honour.winners.length > 1 ? (
                <span className={styles.shared}> shared</span>
              ) : null}
              {honour.winners.some((winner) => winner.isSelf) ? (
                <span className={styles.srOnly}> (you)</span>
              ) : null}
            </span>
            <span className={styles.awardValue}>{honour.value}</span>
            <details className={styles.how}>
              <summary className={styles.howSummary}>How this is calculated</summary>
              <p className={styles.howBody}>{honour.definition}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
