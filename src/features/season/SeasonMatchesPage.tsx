import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import type { MatchRow, SeasonMatchesGateway } from './matchesModel'
import { useSeasonMatches } from './useSeasonMatches'
import styles from './SeasonMatchesPage.module.css'

/**
 * §7.3's Matches section: a competition's fixtures and results, one matchweek
 * at a time.
 *
 * IT ASKS NOTHING ABOUT MEMBERSHIP, and that is the point. Fixtures belong to
 * the competition rather than to any game played on it, so a player following a
 * league can read them without having joined the Main Predictor — the read
 * tolerates a caller with no entry precisely so this is possible. Matches is
 * the first surface in the product that is worth opening before joining
 * anything.
 *
 * IT SHOWS NO PREDICTION AND NO LOCK. Those are the game's, stated by the
 * game's own surface; a fixture list that carried them would be a second entry
 * surface with none of the rules that govern the first.
 *
 * A BLANK SCORE COLUMN IS EXPLAINED RATHER THAN LEFT TO LOOK BROKEN. A
 * matchweek whose results are not in yet renders every fixture with no score,
 * which is honest and looks like a fault; the note above the list says which it
 * is. It disappears once every result is in, because then there is nothing to
 * explain.
 *
 * STEPPING KEEPS THE PREVIOUS MATCHWEEK ON SCREEN. Replacing a readable list
 * with a skeleton on every tap makes the stepper feel broken on a slow
 * connection, so the outgoing matchweek stays until the next one arrives.
 *
 * TIMES AND DATES ARE THE COMPETITION'S, NOT THE VIEWER'S — a Saturday 15:00
 * kickoff is Saturday to everyone who follows that league. The model formats
 * them, unusually for this repository, because the zone is data rather than an
 * ambient fact and keeping it out of the view is what stops it being defaulted
 * away.
 */

export type SeasonMatchesPageProps = {
  gateway: SeasonMatchesGateway
  /** The competition's own timezone; every date and time is resolved in it. */
  timeZone: string
  /** Which matchweek to open at — the next one to lock, or the last played. */
  openAt: number
}

const SKELETON_ROWS = 6

function Match({ match }: { match: MatchRow }) {
  return (
    <li className={styles.match}>
      <span className={styles.srOnly}>{match.accessibleSummary}</span>
      <span className={styles.home} aria-hidden="true">
        {match.homeName}
      </span>
      <span
        className={match.played ? styles.score : styles.kickoff}
        aria-hidden="true"
      >
        {/* A dash, not a zero: an unplayed fixture has no score, and "0 - 0" is
            a result somebody could act on. */}
        {match.score ?? match.kickoff ?? '—'}
      </span>
      <span className={styles.away} aria-hidden="true">
        {match.awayName}
      </span>
    </li>
  )
}

export function SeasonMatchesPage({ gateway, timeZone, openAt }: SeasonMatchesPageProps) {
  const { status, view, stepping, error, previous, next, reload } = useSeasonMatches(
    gateway,
    timeZone,
    openAt,
  )

  if (status === 'loading') {
    return (
      <section className={styles.page} aria-busy="true">
        <h2 className={styles.heading}>Matches</h2>
        <Skeleton width="40%" height={24} />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} width="100%" height={48} />
        ))}
      </section>
    )
  }

  if (status === 'failed' || !view) {
    return (
      <section className={styles.page}>
        <h2 className={styles.heading}>Matches</h2>
        <Alert variant="error" title="We could not load these fixtures">
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>Matches</h2>

      <div className={styles.stepper}>
        <Button
          variant="secondary"
          onClick={previous}
          disabled={!view.hasPrevious || stepping}
          aria-label="Previous matchweek"
        >
          ←
        </Button>
        {/* Announced on change, so a screen-reader user stepping through
            matchweeks hears where they have landed. */}
        <p className={styles.matchweek} aria-live="polite">
          Matchweek {view.matchweek} of {view.matchweekCount}
        </p>
        <Button
          variant="secondary"
          onClick={next}
          disabled={!view.hasNext || stepping}
          aria-label="Next matchweek"
        >
          →
        </Button>
      </div>

      {view.resultsNote ? <p className={styles.note}>{view.resultsNote}</p> : null}

      {view.empty ? (
        <EmptyState
          title="No fixtures in this matchweek"
          description="This matchweek has not been scheduled yet. Try another one."
        />
      ) : (
        <div className={stepping ? styles.stepping : undefined}>
          {view.days.map((day) => (
            <section key={day.key} className={styles.day}>
              <h3 className={styles.dayHeading}>{day.label}</h3>
              <ul className={styles.list}>
                {day.matches.map((match) => (
                  <Match key={match.id} match={match} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
