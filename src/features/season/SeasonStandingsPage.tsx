import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import type { SeasonPeriodStandingsGateway } from './periodStandingsModel'
import { SeasonPeriodStandings } from './SeasonPeriodStandings'
import { formatFieldSize, percentileLine } from './rankContext'
import type { SeasonStandingsGateway, StandingsRow } from './standingsModel'
import { useSeasonStandings } from './useSeasonStandings'
import styles from './SeasonStandingsPage.module.css'

/**
 * The season Match Predictor standings table.
 *
 * IT NAMES ITS GAME, IN THE HEADING, DELIBERATELY. "Standings" alone would read
 * as the season's standings, and a season is not a game — ADR 0011 keeps each
 * game's table its own, and `CLAUDE.md` requires that separation to be visible
 * in the interface rather than merely true in storage. When a second game runs
 * in the same season, two tables headed "Standings" would be indistinguishable
 * and one of them would be wrong.
 *
 * MATCHWEEKS PLAYED IS A COLUMN, NOT A DETAIL. ADR 0012 pairs it with points so
 * that a late joiner's total reads honestly beside an ever-present's, and the
 * whole point is lost if it hides behind a tap.
 *
 * THE PLAYER'S OWN ROW IS ALWAYS REACHABLE. If it falls outside the pages
 * loaded, it is pinned beneath the table rather than requiring the player to
 * page until they find themselves — the model decides when, this renders it.
 *
 * NUMBERS ARE TABULAR (§11.4/§11.7 via --numeric), so a column does not
 * re-width as ranks and points change under it.
 */

export type SeasonStandingsPageProps = {
  gateway: SeasonStandingsGateway
  /** Named so the table cannot be mistaken for a competition-wide ranking. */
  gameName: string
  /**
   * ADR 0012's two retention views, rendered beneath the table when supplied.
   * Optional because they are derived: a surface that can show the season's
   * ranking is complete without them, and the DEV harness has no reason to
   * carry them.
   */
  periods?: SeasonPeriodStandingsGateway
}

const SKELETON_ROWS = 8

function Row({ row, pinned = false }: { row: StandingsRow; pinned?: boolean }) {
  return (
    <li
      className={[styles.row, row.isYou ? styles.rowYou : '', pinned ? styles.rowPinned : '']
        .filter(Boolean)
        .join(' ')}
    >
      {/* One sentence for assistive technology; the cells below are visual. */}
      <span className={styles.srOnly}>{row.accessibleSummary}</span>
      <span className={styles.rank} aria-hidden="true">
        {row.rankLabel}
      </span>
      <span className={styles.name} aria-hidden="true">
        {row.displayName}
        {row.isYou ? <span className={styles.youTag}>You</span> : null}
      </span>
      <span className={styles.played} aria-hidden="true">
        {row.matchweeksPlayed}
      </span>
      <span className={styles.points} aria-hidden="true">
        {row.points}
      </span>
    </li>
  )
}

export function SeasonStandingsPage({
  gateway,
  gameName,
  periods,
}: SeasonStandingsPageProps) {
  const { status, view, loadingMore, error, loadMore, reload } = useSeasonStandings(gateway)

  if (status === 'loading') {
    return (
      <section className={styles.panel} aria-busy="true">
        <h2 className={styles.heading}>{gameName} standings</h2>
        <ul className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className={styles.row}>
              <Skeleton width="100%" height={44} />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (status === 'failed') {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>{gameName} standings</h2>
        <Alert variant="error" title="We could not load the standings">
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </section>
    )
  }

  if (!view || view.totalCount === 0) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>{gameName} standings</h2>
        <EmptyState
          title="No standings yet"
          description="The table appears once the first matchweek is settled. Confirmed results decide it — provisional scores never do."
        />
      </section>
    )
  }

  // Either the caller's row is on screen or the model pinned it below; both
  // carry the same rank, so the sentence does not depend on how far they paged.
  const you = view.pinnedYou ?? view.rows.find((row) => row.isYou) ?? null

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>{gameName} standings</h2>
      <p className={styles.caption}>
        {formatFieldSize(view.totalCount)} {view.totalCount === 1 ? 'player' : 'players'}, ranked on
        points from settled matchweeks.
      </p>

      {/* Where the caller stands, said once and in words. The table already
          marks their row, but a player arriving at a 200-row leaderboard should
          not have to find themselves in it to learn their own position — and
          the read has always carried it. Absent when they hold no settled
          matchweek, because there is no position to state. */}
      {you ? (
        <p className={styles.yourStanding}>
          You are {you.rankLabel.replace('=', 'joint ')} of {formatFieldSize(view.totalCount)} on{' '}
          {you.points} {you.points === 1 ? 'point' : 'points'}.
          {/* Context, not movement. Both numbers are the server's and the
              percentile is arithmetic over them; "up 3 this matchweek" needs
              history no read exposes and is deliberately absent. */}
          {percentileLine(you.rank, view.totalCount) ? (
            <span className={styles.percentile}>
              {percentileLine(you.rank, view.totalCount)}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className={styles.columns} aria-hidden="true">
        <span className={styles.rank}>#</span>
        <span className={styles.name}>Player</span>
        <span className={styles.played}>
          <abbr title="Matchweeks played">MW</abbr>
        </span>
        <span className={styles.points}>Pts</span>
      </div>

      <ul className={styles.list}>
        {view.rows.map((row) => (
          <Row key={row.key} row={row} />
        ))}
      </ul>

      {view.pinnedYou ? (
        <ul className={[styles.list, styles.pinnedList].join(' ')}>
          <Row row={view.pinnedYou} pinned />
        </ul>
      ) : null}

      {/* An append failure keeps the loaded rows and says so, rather than
          replacing a readable table with an error page. */}
      {error ? (
        <Alert variant="error" title="We could not load more">
          {error}
        </Alert>
      ) : null}

      {view.hasMore ? (
        <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}

      {/* Only once the season has a table of its own. Both derived views read
          the same settled matchweeks, so before the first settlement they are
          two more empty states under an empty state. */}
      {periods ? <SeasonPeriodStandings gateway={periods} /> : null}
    </section>
  )
}
