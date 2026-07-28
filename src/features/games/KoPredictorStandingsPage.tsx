import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { fetchKoPredictorStandings } from '../../services/supabase/koPredictorStandings'
import type {
  KoStandingRow,
  KoStandingsSummary,
} from '../../services/supabase/koPredictorStandingsModel'
import { userFacingError } from '../../shared/errors/userFacingError'
import s from '../shared.module.css'
import g from './games.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      rows: KoStandingRow[]
      me: KoStandingsSummary | null
      nextCursor: string | null
    }

export function KoPredictorStandingsPage() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  useEffect(() => {
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!tournamentId) {
      setState({ status: 'loading' })
      return
    }

    let active = true
    setState({ status: 'loading' })
    fetchKoPredictorStandings(tournamentId)
      .then((read) => {
        if (active) {
          setState({
            status: 'ready',
            rows: read.standings,
            me: read.me,
            nextCursor: read.nextCursor,
          })
        }
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(
              error,
              'The KO Predictor standings are unavailable. Please try again.',
            ),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data.status, reloadKey, tournamentId])

  async function handleLoadMore() {
    if (state.status !== 'ready' || !state.nextCursor || !tournamentId || loadingMore) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const read = await fetchKoPredictorStandings(tournamentId, state.nextCursor)
      setState({
        status: 'ready',
        rows: [...state.rows, ...read.standings],
        me: state.me,
        nextCursor: read.nextCursor,
      })
    } catch (error) {
      setMoreError(userFacingError(error, 'We couldn’t load more standings. Please try again.'))
    } finally {
      setLoadingMore(false)
    }
  }

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/games')}>
        <ChevronLeftIcon size={16} /> Games
      </button>
      <h1 className={s.title}>KO Predictor</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn’t load the standings">
          {state.message}
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={6} />
        </div>
      </div>
    )
  }

  return (
    <div className={s.page}>
      {header}

      <p className={g.tagline}>
        Global standings. Exact scoreline 5 · correct result 3 · advancing team +2
        (stacking, and paying alone with the right team through). No jokers.
      </p>

      {state.me ? (
        <div className={s.card}>
          <span className={s.eyebrow}>Your position</span>
          <p className={g.stateLine}>
            Rank {state.me.rank} · {state.me.totalPoints} points · {state.me.exactCount}{' '}
            exact · {state.me.resultCount} results · {state.me.throughCount} through
          </p>
        </div>
      ) : null}

      {state.rows.length === 0 ? (
        <EmptyState
          title="No entrants yet"
          description="Standings appear as soon as someone enters the KO Predictor. Points arrive with each officially confirmed knockout result."
        />
      ) : (
        <div className={s.card}>
          <table className={g.standingsTable}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Player</th>
                <th scope="col" aria-label="Exact scorelines">
                  E
                </th>
                <th scope="col" aria-label="Correct results">
                  R
                </th>
                <th scope="col" aria-label="Advancing teams">
                  T
                </th>
                <th scope="col">Pts</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr
                  key={row.userId}
                  className={row.userId === userId ? g.ownRow : undefined}
                >
                  <td>{row.rank}</td>
                  <td>
                    {row.displayName}
                    {row.userId === userId ? ' (you)' : ''}
                  </td>
                  <td>{row.exactCount}</td>
                  <td>{row.resultCount}</td>
                  <td>{row.throughCount}</td>
                  <td>{row.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {moreError ? (
        <Alert variant="error" title="That didn’t work">
          {moreError}
        </Alert>
      ) : null}

      {state.nextCursor ? (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => void handleLoadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </div>
  )
}
