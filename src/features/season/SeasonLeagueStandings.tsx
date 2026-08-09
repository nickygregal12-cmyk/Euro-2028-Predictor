import { Alert, Button, Skeleton } from '../../design-system'
import type { LeagueStandingsRow, SeasonLeagueStandingsGateway } from './leagueStandingsModel'
import { useSeasonLeagueStandings } from './useSeasonLeagueStandings'
import styles from './SeasonLeagueStandings.module.css'

/**
 * One season private league's table, rendered inside its card on the Leagues
 * surface.
 *
 * IT IS NOT A PAGE, and that is a deliberate difference from the season
 * standings. A member belongs to several leagues in the same game, and a table
 * that required navigating away and back to compare two of them would make the
 * common act the expensive one. It opens in place, one at a time.
 *
 * IT SAYS WHOSE TABLE IT IS. A private league ranks one game inside one
 * competition (ADR 0011), so the heading names the league rather than reading
 * "Standings" — two open tables headed the same thing would be two claims to
 * the same ranking, and one of them would be wrong.
 *
 * A MEMBER WHO HAS NOT ENTERED SHOWS "NOT ENTERED", NOT A ZERO. The model
 * decides when; this renders it, in text rather than by a dimmed row, because
 * §11.8 forbids conveying status by colour alone and a greyed row would say
 * nothing at all to a screen reader.
 *
 * NUMBERS ARE TABULAR (§11.4/§11.7 via --numeric), so a column does not
 * re-width as ranks and points change under it.
 */

export type SeasonLeagueStandingsProps = {
  gateway: SeasonLeagueStandingsGateway
  leagueId: string
  /** Named in the heading so two open tables can never be confused. */
  leagueName: string
}

const SKELETON_ROWS = 4

function Row({ row, pinned = false }: { row: LeagueStandingsRow; pinned?: boolean }) {
  return (
    <li
      className={[styles.row, row.isYou ? styles.rowYou : '', pinned ? styles.rowPinned : '']
        .filter(Boolean)
        .join(' ')}
    >
      {/* One sentence for assistive technology; the cells below are visual. */}
      <span className={styles.srOnly}>{row.accessibleSummary}</span>
      <span className={styles.rank} aria-hidden="true">
        {row.notEnteredLabel ? '–' : row.rankLabel}
      </span>
      <span className={styles.name} aria-hidden="true">
        {row.displayName}
        {row.isYou ? <span className={styles.tag}>You</span> : null}
        {row.isOwner ? <span className={styles.ownerTag}>Owner</span> : null}
      </span>
      {row.notEnteredLabel ? (
        <span className={styles.notEntered} aria-hidden="true">
          {row.notEnteredLabel}
        </span>
      ) : (
        <>
          <span className={styles.played} aria-hidden="true">
            {row.matchweeksPlayed}
          </span>
          <span className={styles.points} aria-hidden="true">
            {row.points}
          </span>
        </>
      )}
    </li>
  )
}

export function SeasonLeagueStandings({
  gateway,
  leagueId,
  leagueName,
}: SeasonLeagueStandingsProps) {
  const { status, view, loadingMore, error, loadMore, reload } = useSeasonLeagueStandings(
    gateway,
    leagueId,
  )

  if (status === 'loading') {
    return (
      <div className={styles.table} aria-busy="true">
        <ul className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} className={styles.row}>
              <Skeleton width="100%" height={40} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className={styles.table}>
        <Alert variant="error" title={`We could not load ${leagueName}'s table`}>
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  }

  if (!view) return null

  return (
    <div className={styles.table}>
      <p className={styles.caption}>{view.captionLine}</p>

      {/* Where the caller stands, said once and in words. The table marks their
          row, but a member of a forty-strong league should not have to find
          themselves in it to learn their own position. */}
      {view.yourStandingLine ? (
        <p className={styles.yourStanding}>{view.yourStandingLine}</p>
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
          replacing a readable table with an error. */}
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
    </div>
  )
}
