import { useId } from 'react'
import type { MatchweekRecap as MatchweekRecapModel } from '../models/home'
import { formatNumber, formatOrdinal } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { StatTile } from '../components/game/StatTile'
import styles from './home.module.css'

export type MatchweekRecapProps = {
  readonly recap: MatchweekRecapModel | null | undefined
}

/**
 * THE MATCHWEEK RECAP — what the last settled matchweek was worth.
 *
 * ============================ WHY IT SITS LOW ON THE PAGE ================
 *
 * Home's hierarchy is football first: what needs you, what is happening, what
 * happened. The recap is none of those — it is how you DID, which is the
 * question a player asks after they have seen the results, not before. So it
 * belongs beside the season standing rather than above the deadline, and it is
 * the first thing in the lower band rather than the last thing in the upper
 * one.
 *
 * ============================ IT STATES, IT DOES NOT SCORE ===============
 *
 * Every number here was banked by an authority: the matchweek's points and the
 * season figures are contract 151's, and the league movement is contract 150's.
 * Nothing is computed, nothing is estimated, and the movement's SIGN is the
 * server's — a rank is a smaller number when you are doing better, which is
 * exactly the subtraction a presentation layer gets backwards.
 *
 * A NULL IS A MISSING CAPABILITY, NEVER A ZERO. A season rank the read did not
 * state is omitted; it is not printed as "unranked", and it is certainly not
 * printed as 0.
 */
export function MatchweekRecap({ recap }: MatchweekRecapProps) {
  const headingId = useId()

  if (!recap) return null

  const ranked = recap.seasonRank !== null && recap.fieldSize !== null

  return (
    <section
      className={styles.recap}
      data-vnext-zone="recap"
      aria-labelledby={headingId}
    >
      <div className={styles.recapHead}>
        <h2 id={headingId} className={`${typography.label} ${styles.zoneTitle}`}>
          {recap.matchweekLabel} · how you did
        </h2>
        {recap.jokerPlayed ? (
          <span className={styles.recapJoker}>
            Joker played
            <span className={typography.srOnly}>, on this matchweek</span>
          </span>
        ) : null}
      </div>

      <div className={styles.recapTiles}>
        <StatTile
          label="Matchweek points"
          value={formatNumber(recap.points)}
          tone="accent"
        />
        {recap.seasonPoints === null ? null : (
          <StatTile label="Season total" value={formatNumber(recap.seasonPoints)} />
        )}
        {ranked ? (
          <StatTile
            label="Season rank"
            value={formatOrdinal(recap.seasonRank as number)}
            meta={`of ${formatNumber(recap.fieldSize as number)}`}
          />
        ) : null}
        {recap.exactScores === null ? null : (
          <StatTile
            label="Exact scores"
            value={formatNumber(recap.exactScores)}
            meta={
              recap.correctOutcomes === null
                ? undefined
                : `${formatNumber(recap.correctOutcomes)} right result`
            }
          />
        )}
      </div>

      {recap.leagues.length === 0 ? null : (
        <ul className={styles.recapLeagues}>
          {recap.leagues.map((league) => (
            <li key={league.leagueId} className={styles.recapLeague}>
              <span className={`${typography.body} ${typography.clamp2}`}>
                {league.leagueName}
              </span>
              <span className={`${typography.micro} ${styles.recapMove}`}>
                {/* THE WORD IS THE STATE. A climb is never carried by an arrow
                    or a colour alone, here or anywhere else in vNext. */}
                {league.movement > 0
                  ? `Up ${formatNumber(league.movement)}`
                  : league.movement < 0
                    ? `Down ${formatNumber(Math.abs(league.movement))}`
                    : 'No change'}
              </span>
              <span className={`${typography.micro} ${typography.numeric}`}>
                {formatOrdinal(league.rankAfter)} of {formatNumber(league.fieldSize)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
