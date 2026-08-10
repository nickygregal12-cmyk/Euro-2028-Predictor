import { Link, useLocation } from 'react-router'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { competitionRoute, competitionRefFromPath, weeklyRoutes } from '../../app/weeklyRoutes'
import styles from './CompetitionSwitcher.module.css'

/**
 * The compact competition selector in the competition masthead.
 *
 * WHAT IT REPLACES, AND WHY THAT HAD TO GO. The masthead carried a link reading
 * "Switch to Scottish Premiership", built by asking whether the current
 * competition slug was `premier-league` and picking the other one — with the
 * season hard-coded to `2026-27`. It was the clearest place in the product where
 * the two-competition world was written into the code rather than into the data,
 * and on a platform of twenty competitions it would offer exactly one of them,
 * chosen by an `if`.
 *
 * IT PRIORITISES THE PLAYER'S OWN COMPETITIONS, then Explore. That is the
 * authority's structure and the same rule the rail follows: a player who plays
 * in three competitions on a platform of twenty is offered their three and a
 * way to the rest, never twenty rows.
 *
 * IT PRESERVES THE SECTION. Switching from Premier League's Matches lands on
 * Scottish Premiership's Matches, by swapping the competition base in the
 * current address — every competition has the same section structure, so this
 * is a substitution rather than a guess. Query and hash travel too, so a
 * matchweek parameter survives the switch.
 *
 * A DISCLOSURE, NOT A MENU WIDGET. `details`/`summary` is a real control with
 * real keyboard behaviour and no focus management of its own to get wrong, and
 * every option inside it is an ordinary link.
 */

export function CompetitionSwitcher({ competitionName }: { competitionName: string }) {
  const { pathname, search, hash } = useLocation()
  const { player } = usePlayerCompetitions()
  const ref = competitionRefFromPath(pathname)
  if (!ref) return null

  const here = competitionRoute(ref)
  const others = (player?.mine ?? []).filter(
    (entry) => competitionRoute(entry.competition) !== here,
  )

  return (
    <details className={styles.switcher}>
      <summary className={styles.summary}>
        <span className={styles.current}>{competitionName}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className={styles.menu}>
        {others.length > 0 ? (
          <>
            <p className={styles.groupTitle}>Your competitions</p>
            <ul className={styles.list}>
              {others.map((entry) => (
                <li key={entry.competition.seasonRowName}>
                  <Link
                    className={styles.option}
                    to={`${pathname.replace(here, competitionRoute(entry.competition))}${search}${hash}`}
                  >
                    <span className={styles.name}>{entry.competition.name}</span>
                    <span className={styles.season}>{entry.competition.seasonLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          // Not an empty menu: a player who plays in one competition is told
          // that, and pointed at where the others are.
          <p className={styles.only}>This is the only competition you play in.</p>
        )}
        <Link className={styles.explore} to={weeklyRoutes.competitions}>
          All competitions
        </Link>
      </div>
    </details>
  )
}
