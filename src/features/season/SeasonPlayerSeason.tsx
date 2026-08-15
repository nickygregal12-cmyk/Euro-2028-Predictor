import type { SeasonPlayerProfile } from '../../services/supabase/seasonPlayerProfileModel'
import { ordinal } from '../league/ordinal'
import styles from './SeasonPlayerProfileRoute.module.css'

/**
 * One player's season, as presentation (contract 151).
 *
 * SPLIT FROM THE ROUTE so it renders from a read-model value alone. The route
 * resolves the season and the player and owns every failure state; this
 * component imports no Supabase client and no gateway, which is what lets the
 * component gallery photograph it and what the architecture rule about
 * components and Supabase asks for.
 *
 * IT PRINTS AND DERIVES NOTHING. Points, rank, field size, matchweek totals and
 * the exact/correct counts all arrive decided; there is no arithmetic here at
 * all, so no second scoring authority can grow in it.
 *
 * NEVER A BARE RANK. Position and field size are rendered together, because a
 * position without the field it was won in says nothing about how it was
 * earned.
 */
export function SeasonPlayerSeason({ profile }: { profile: SeasonPlayerProfile }) {
  const { player, season, accuracy, jokers, history } = profile

  if (!profile.entered) {
    return (
      <div className={styles.identity}>
        <h1 className={styles.name}>{player.displayName}</h1>
        {/* A co-member who never entered is a real answer, not an error. */}
        <p className={styles.note}>
          {player.isSelf
            ? 'You have not entered this competition season yet.'
            : 'This player is in your league but has not entered this competition season.'}
        </p>
      </div>
    )
  }

  return (
    <div className={styles.playerSeason}>
      <div className={styles.identity}>
        <h1 className={styles.name}>{player.displayName}</h1>
        {player.isSelf ? <span className={styles.you}>This is you</span> : null}
      </div>

      <ul className={styles.stats}>
        {season ? (
          <>
            <li className={styles.stat}>
              <span className={styles.statValue}>{season.points}</span>
              <span className={styles.statLabel}>Season points</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{ordinal(season.rank)}</span>
              {/* Never a bare rank: a position without a field size says
                  nothing about how it was earned. */}
              <span className={styles.statLabel}>of {season.fieldSize} players</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{season.matchweeksPlayed}</span>
              <span className={styles.statLabel}>Matchweeks played</span>
            </li>
          </>
        ) : null}
        {accuracy ? (
          <>
            <li className={styles.stat}>
              <span className={styles.statValue}>{accuracy.exactScores}</span>
              <span className={styles.statLabel}>Exact scores</span>
              <span className={styles.statNote}>
                of {accuracy.fixturesPredicted} settled predictions
              </span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{accuracy.correctOutcomes}</span>
              <span className={styles.statLabel}>Correct results</span>
              <span className={styles.statNote}>
                of {accuracy.fixturesPredicted} settled predictions
              </span>
            </li>
          </>
        ) : null}
        {jokers && jokers.played > 0 ? (
          <li className={styles.stat}>
            <span className={styles.statValue}>{jokers.played}</span>
            <span className={styles.statLabel}>Jokers played</span>
            <span className={styles.statNote}>
              {jokers.pointsFromJokerMatchweeks} pts in those matchweeks
            </span>
          </li>
        ) : null}
      </ul>

      <h2 className={styles.sectionTitle}>Matchweek history</h2>

      {history.length === 0 ? (
        <p className={styles.note}>
          {player.isSelf
            ? 'Nothing to show yet — your first predicted matchweek appears here.'
            : 'No matchweek of theirs has locked yet.'}
        </p>
      ) : (
        <ul className={styles.history}>
          {history.map((matchweek) => (
            <li className={styles.matchweek} key={matchweek.matchweekId}>
              <div className={styles.matchweekTop}>
                <span className={styles.matchweekLabel}>{matchweek.label}</span>
                {matchweek.points === null ? (
                  // Absent points and zero points are different answers.
                  <span className={styles.matchweekPending}>Not settled</span>
                ) : (
                  <span className={styles.matchweekPoints}>{matchweek.points} pts</span>
                )}
              </div>
              {matchweek.jokerPlayed ? <span className={styles.joker}>Joker</span> : null}
              <ul className={styles.picks}>
                {Object.entries(matchweek.predictions).map(([fixtureId, prediction]) => (
                  <li className={styles.pick} key={fixtureId}>
                    {prediction.home} - {prediction.away}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.note}>
        Predictions appear once that matchweek has locked at its first kickoff. Your own are
        always visible to you.
      </p>
    </div>
  )
}
