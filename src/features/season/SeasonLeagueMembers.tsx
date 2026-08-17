import { Link } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import type { SeasonLeagueStandingsGateway } from './leagueStandingsModel'
import { useSeasonLeagueStandings } from './useSeasonLeagueStandings'
import styles from './SeasonLeagueStandings.module.css'

/**
 * Who is in a private league — the workspace's Members tab.
 *
 * IT IS NOT A SECOND READ. The rows come from contract 128's league standings,
 * which the Table tab already loads: membership, display name, owner flag,
 * points and matchweeks played all arrive together, and asking a second
 * authority for the same list is how two views of one league start disagreeing
 * about who is in it.
 *
 * WHAT MAKES IT A DIFFERENT TAB. Table answers "who is winning" and is ordered
 * by rank; Members answers "who am I playing with" and is ordered by name, with
 * the owner named and a route into each player's season. Ordering by name is
 * the whole point: a member list that reshuffles as results come in is a list
 * you cannot find anybody in.
 *
 * IT IS NOT A SOCIAL NETWORK, and must not grow into one. The only people here
 * are co-members of this private league, the only action is to open one
 * player's season, and there is no following, requesting, messaging or
 * discovery. Contract 151 refuses anybody who does not share a private league
 * with the player, so the link is offered exactly where the server will answer.
 */

export type SeasonLeagueMembersProps = {
  gateway: SeasonLeagueStandingsGateway
  leagueId: string
  leagueName: string
  /** Where a member's name links. Omitted renders plain text. */
  playerHref?: ((playerId: string) => string) | undefined
}

const SKELETON_ROWS = 4

export function SeasonLeagueMembers({
  gateway,
  leagueId,
  leagueName,
  playerHref,
}: SeasonLeagueMembersProps) {
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
        <Alert variant="error" title={`We could not load ${leagueName}'s members`}>
          {error}
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  }

  if (!view) return null

  // By name, so the list is findable. The rank stays on each row, because a
  // member list that hid it would send a player back to the table to answer
  // "and how are they doing".
  const members = [...view.rows].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  )

  return (
    <div className={styles.table}>
      <p className={styles.caption}>
        {members.length} {members.length === 1 ? 'member' : 'members'} · the people you play with
        in {leagueName}
      </p>

      <ul className={styles.list}>
        {members.map((row) => {
          const href = row.userId ? playerHref?.(row.userId) : undefined
          return (
            <li
              key={row.key}
              className={[styles.row, row.isYou ? styles.rowYou : ''].filter(Boolean).join(' ')}
            >
              <span className={styles.srOnly}>{row.accessibleSummary}</span>
              <span className={styles.rank} aria-hidden="true">
                {row.notEnteredLabel ? '–' : row.rankLabel}
              </span>
              <span className={styles.name} aria-hidden="true">
                {href ? <Link to={href}>{row.displayName}</Link> : row.displayName}
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
        })}
      </ul>

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
