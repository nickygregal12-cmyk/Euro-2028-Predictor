import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { ChevronLeftIcon, TrophyIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { useLiveResultsVersion } from '../../app/providers/liveResultsContext'
import { areFinalStandingsActive } from '../../domain/tournament/finalStandings'
import {
  fetchLeaderboardPage,
  type LeaderboardRow as LeaderboardEntry,
  type LeaderboardYou,
} from '../../services/supabase/leaderboard'
import { FinalStandingsNote } from './FinalStandingsNote'
import { LeaderboardRow } from './LeaderboardRow'
import s from '../shared.module.css'
import l from './leaderboard.module.css'

const PAGE_SIZE = 50

// `get_leaderboard` clamps a page to 100 rows. Past that a live refresh cannot
// rebuild the view in one request, and stitching a fresh head onto stale tail
// pages under a moving ranking shows duplicates and gaps -- so a list this deep
// holds still instead. The player's own standing still moves on Home.
const MAX_LIVE_REFRESH_ROWS = 100

type ReadyData = {
  rows: LeaderboardEntry[]
  totalCount: number
  hasMore: boolean
  nextCursor: string | null
  you: LeaderboardYou | null
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ReadyData }

export function OverallStandingsPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const finalStandings =
    data.status === 'ready' && areFinalStandingsActive(data.data.matches)
  const [state, setState] = useState<State>({ status: 'loading' })
  const resultsVersion = useLiveResultsVersion()

  // THREE PATHS FETCH THIS LIST -- first load/retry, a live refresh, and
  // "load more" -- and they can overlap. One shared counter decides which
  // response is still wanted: whoever starts last wins, and an older response
  // is dropped rather than merged into a newer snapshot. Without it a paging
  // response that lands after a refresh splices pre-change rows into the
  // refreshed head and carries its stale cursor with them.
  const requestGenerationRef = useRef(0)

  // The live version the displayed rows were fetched at. This is what stops an
  // invalidation arriving mid-load from being lost: it simply will not match,
  // and the live effect re-runs the moment the page turns ready.
  const fetchedAtVersionRef = useRef(0)
  const versionRef = useRef(resultsVersion)
  versionRef.current = resultsVersion
  const [reloadKey, setReloadKey] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const youRow = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tournamentId) return
    let active = true
    const generation = ++requestGenerationRef.current
    // Read through a ref: this effect deliberately does not depend on the live
    // version, but it still needs to know which one its snapshot represents.
    const startedAtVersion = versionRef.current
    setState({ status: 'loading' })
    setLoadingMore(false)
    setMoreError(null)

    fetchLeaderboardPage(tournamentId, { limit: PAGE_SIZE })
      .then((page) => {
        if (!active || generation !== requestGenerationRef.current) return
        fetchedAtVersionRef.current = startedAtVersion
        setState({
          status: 'ready',
          data: {
            rows: page.rows,
            totalCount: page.totalCount,
            hasMore: page.hasMore,
            nextCursor: page.nextCursor,
            you: page.you,
          },
        })
      })
      .catch((error) => {
        if (active && generation === requestGenerationRef.current) {
          setState({
            status: 'error',
            message: userFacingError(error, 'Could not load standings. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [tournamentId, reloadKey])

  // ONCE. This used to run on every state change, so loading another page --
  // and now a live refresh -- yanked the viewport back to the player's own row
  // while they were reading somewhere else. Finding your row is a landing
  // courtesy, not something to redo under them.
  const hasScrolledToYou = useRef(false)
  useEffect(() => {
    if (hasScrolledToYou.current) return
    if (state.status === 'ready' && state.data.rows.some((row) => row.isYou)) {
      hasScrolledToYou.current = true
      youRow.current?.scrollIntoView({ block: 'center' })
    }
  }, [state])

  // The live path. Separate from the mount/retry effect above on purpose: this
  // one must never blank the list, never replace good data with an error, and
  // never widen or narrow how far the player has paged.
  //
  // It depends on `state` as well as the version, so an invalidation that
  // arrives while the first load is still in flight is NOT lost -- the effect
  // re-runs when the page turns ready and finds the versions still unequal.
  useEffect(() => {
    if (!tournamentId || state.status !== 'ready') return
    if (fetchedAtVersionRef.current === resultsVersion) return

    const shown = state.data.rows.length
    if (shown > MAX_LIVE_REFRESH_ROWS) {
      // Deliberately not refreshed -- but record the version anyway, or this
      // re-evaluates on every later state change and never settles.
      fetchedAtVersionRef.current = resultsVersion
      return
    }
    const limit = Math.min(Math.max(shown, PAGE_SIZE), MAX_LIVE_REFRESH_ROWS)

    let active = true
    const generation = ++requestGenerationRef.current
    const startedAtVersion = resultsVersion
    fetchLeaderboardPage(tournamentId, { limit })
      .then((page) => {
        if (!active || generation !== requestGenerationRef.current) return
        fetchedAtVersionRef.current = startedAtVersion
        setState({
          status: 'ready',
          data: {
            rows: page.rows,
            totalCount: page.totalCount,
            hasMore: page.hasMore,
            nextCursor: page.nextCursor,
            you: page.you,
          },
        })
      })
      .catch(() => {
        // Deliberately silent. A background refresh that fails leaves the
        // standings the player is already reading exactly where they are, and
        // the version stays unapplied so the next signal tries again.
      })

    return () => {
      active = false
    }
  }, [resultsVersion, tournamentId, state])

  async function loadMore() {
    if (
      !tournamentId ||
      state.status !== 'ready' ||
      !state.data.hasMore ||
      !state.data.nextCursor ||
      loadingMore
    ) {
      return
    }

    setLoadingMore(true)
    setMoreError(null)
    // The cursor below was produced by the ranking as it stood a moment ago. If
    // a live refresh lands first, this page belongs to a snapshot that no longer
    // exists and merging it would splice stale rows and a stale cursor into the
    // refreshed list.
    const generation = ++requestGenerationRef.current
    try {
      const page = await fetchLeaderboardPage(tournamentId, {
        limit: PAGE_SIZE,
        after: state.data.nextCursor,
      })
      if (generation !== requestGenerationRef.current) return
      setState((current) => {
        if (current.status !== 'ready') return current
        const byPosition = new Map(
          [...current.data.rows, ...page.rows].map((row) => [row.position, row]),
        )
        return {
          status: 'ready',
          data: {
            rows: [...byPosition.values()].sort((a, b) => a.position - b.position),
            totalCount: page.totalCount,
            hasMore: page.hasMore,
            nextCursor: page.nextCursor,
            you: page.you,
          },
        }
      })
    } catch (error: unknown) {
      if (generation === requestGenerationRef.current) {
        setMoreError(
          userFacingError(error, 'Could not load more standings. Please try again.'),
        )
      }
    } finally {
      // Always cleared, superseded or not: a spinner left spinning is worse
      // than a page that quietly refreshed underneath the request.
      setLoadingMore(false)
    }
  }

  const header = (
    <div className={s.header}>
      <button type="button" className={l.back} onClick={() => navigate('/league')}>
        <ChevronLeftIcon size={16} /> League
      </button>
      <h1 className={s.title}>Overall standings</h1>
      <p className={s.sub}>
        {finalStandings ? 'The final table after every tournament result.' : 'All players, everywhere.'}
      </p>
    </div>
  )

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load the tournament">{data.message}</Alert>
      </div>
    )
  }

  if (state.status === 'loading' || data.status !== 'ready') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}><Skeleton lines={6} /></div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load standings">
          {state.message}
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>Retry</Button>
          </div>
        </Alert>
      </div>
    )
  }

  const { rows, totalCount, hasMore, you } = state.data
  if (rows.length === 0) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          icon={<TrophyIcon size={22} />}
          title="No entries yet"
          description="The overall standings fill up as players submit their predictions."
        />
      </div>
    )
  }

  const youLoaded = rows.some((row) => row.isYou)

  return (
    <div className={s.page}>
      {header}
      {finalStandings ? <FinalStandingsNote /> : null}

      {you && !youLoaded ? (
        <section className={l.yourPosition} aria-labelledby="your-position-heading">
          <div className={l.yourPositionHeader}>
            <span id="your-position-heading">Your position</span>
            <span>{you.position} of {totalCount}</span>
          </div>
          <LeaderboardRow
            rank={you.rank}
            name={you.displayName}
            points={you.totalPoints}
            isYou
          />
        </section>
      ) : null}

      <div className={l.table}>
        <div className={l.headRow}>
          <span>#</span>
          <span />
          <span />
          <span>Player</span>
          <span className={l.headPts}>Pts</span>
        </div>
        {rows.map((entry) => (
          <div key={entry.position} ref={entry.isYou ? youRow : undefined}>
            <LeaderboardRow
              rank={entry.rank}
              name={entry.displayName}
              points={entry.totalPoints}
              isYou={entry.isYou}
            />
          </div>
        ))}
      </div>

      <p className={l.loadedCount}>Showing {rows.length} of {totalCount}</p>

      {moreError ? (
        <Alert variant="warning" title="Couldn't load more standings">{moreError}</Alert>
      ) : null}

      {hasMore ? (
        <Button variant="secondary" fullWidth loading={loadingMore} onClick={loadMore}>
          Load more standings
        </Button>
      ) : null}
    </div>
  )
}
