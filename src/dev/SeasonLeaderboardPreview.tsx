import { useState } from 'react'
import { Alert, Button, EmptyState, Skeleton } from '../design-system'
import {
  fetchSeasonLeaderboardPage,
  type SeasonLeaderboardPage,
} from '../services/supabase/seasonLeaderboard'
import { userFacingError } from '../shared/errors/userFacingError'
import styles from './SeasonLeaderboardPreview.module.css'

/**
 * A real season leaderboard, read from the real database (DEV only).
 *
 * WHY THIS EXISTS AND WHY IT IS NOT A PRODUCT SURFACE. Contracts 90 to 96 gave
 * the season a score store, settlement parity, a replay link, an hourly scoring
 * job, a ranked table and a bounded read. Every one of them was proven by pgTAP
 * and differential sweeps, and not one of them had ever been exercised by a
 * browser. A chain that long, verified only from inside the database, has a
 * particular failure mode: each link is correct and the join between the last
 * link and a client is untested.
 *
 * `SeasonPreview` next door renders a season from a fixture and touches no
 * database. This page is its opposite — it renders nothing of its own and reads
 * everything, so what it proves is the seam: RPC name, argument names, response
 * shape, the parser, and the access boundary refusing a caller with no entry.
 *
 * It stays under `/dev` because no season is launched and no navigation points
 * here. Making it a product page would claim a season surface exists, which is
 * the kind of overstatement `docs/quality/current-status.md` has had to correct
 * twice already.
 */

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: SeasonLeaderboardPage; rows: SeasonLeaderboardPage['rows'] }

const PAGE_SIZE = 25

export function SeasonLeaderboardPreview() {
  const [seasonId, setSeasonId] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })
  const [loadingMore, setLoadingMore] = useState(false)

  function load() {
    if (seasonId.trim().length === 0) return
    setState({ status: 'loading' })
    fetchSeasonLeaderboardPage(seasonId.trim(), { limit: PAGE_SIZE })
      .then((page) => setState({ status: 'ready', page, rows: page.rows }))
      .catch((error: unknown) =>
        setState({ status: 'error', message: userFacingError(error) }),
      )
  }

  function loadMore() {
    if (state.status !== 'ready' || !state.page.hasMore) return
    setLoadingMore(true)
    fetchSeasonLeaderboardPage(seasonId.trim(), {
      limit: PAGE_SIZE,
      after: state.page.nextCursor,
    })
      .then((page) =>
        setState({ status: 'ready', page, rows: [...state.rows, ...page.rows] }),
      )
      .catch((error: unknown) =>
        setState({ status: 'error', message: userFacingError(error) }),
      )
      .finally(() => setLoadingMore(false))
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Season leaderboard (DEV)</h1>
      <p className={styles.note}>
        Reads <code>get_season_leaderboard</code> against the configured database. The
        RPC refuses any caller holding no entry in the season asked for, so signing in
        as a player from another season is the quickest way to see the boundary work.
      </p>

      <div className={styles.controls}>
        <label className={styles.label} htmlFor="season-id">
          Season (competition) id
        </label>
        <input
          id="season-id"
          className={styles.input}
          value={seasonId}
          onChange={(event) => setSeasonId(event.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
        />
        <Button onClick={load} disabled={seasonId.trim().length === 0}>
          Load
        </Button>
      </div>

      {state.status === 'loading' ? <Skeleton /> : null}

      {state.status === 'error' ? (
        <Alert variant="error" title="The season leaderboard could not be read">
          {state.message}
        </Alert>
      ) : null}

      {state.status === 'ready' && state.rows.length === 0 ? (
        <EmptyState title="Nobody is in this season yet" />
      ) : null}

      {state.status === 'ready' && state.rows.length > 0 ? (
        <>
          <table className={styles.table}>
            <caption className={styles.caption}>
              {state.page.totalCount} in the season
              {state.page.you
                ? ` — you are ${state.page.you.rank}${state.page.you.tied ? ' (tied)' : ''} on ${state.page.you.points} from ${state.page.you.matchweeksPlayed}`
                : ''}
            </caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col">Points</th>
                {/* ADR 0012 pairs these two: equal points over different
                    matchweeks are not equal in meaning. */}
                <th scope="col">Played</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.position} className={row.isYou ? styles.you : undefined}>
                  <td>
                    {row.rank}
                    {row.tied ? '=' : ''}
                  </td>
                  <td>{row.displayName}</td>
                  <td>{row.points}</td>
                  <td>{row.matchweeksPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {state.page.hasMore ? (
            <Button onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
