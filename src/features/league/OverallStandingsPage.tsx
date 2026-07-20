import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { ChevronLeftIcon, TrophyIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { rankLeaderboard, type RankedEntry } from '../../domain/tournament/rankLeaderboard'
import { fetchLeaderboard } from '../../services/supabase/leaderboard'
import { LeaderboardRow } from './LeaderboardRow'
import s from '../shared.module.css'
import l from './leaderboard.module.css'

// The full overall standings table (every submitted entry). Reached from the
// League hub's overall-standings card (design-system §6 — the card taps into the
// full table). Ranking is applied in the pure domain (rankLeaderboard).
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: RankedEntry[] }

export function OverallStandingsPage() {
  const navigate = useNavigate()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const [state, setState] = useState<State>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const youRow = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tournamentId) return
    let active = true
    setState({ status: 'loading' })
    fetchLeaderboard(tournamentId)
      .then((rows) => {
        if (active) setState({ status: 'ready', rows: rankLeaderboard(rows) })
      })
      .catch((e) => {
        if (active) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Failed to load standings.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [tournamentId, reloadKey])

  useEffect(() => {
    if (state.status === 'ready') youRow.current?.scrollIntoView({ block: 'center' })
  }, [state.status])

  const header = (
    <div className={s.header}>
      <button type="button" className={l.back} onClick={() => navigate('/league')}>
        <ChevronLeftIcon size={16} /> League
      </button>
      <h1 className={s.title}>Overall standings</h1>
      <p className={s.sub}>All players, everywhere.</p>
    </div>
  )

  if (data.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load the tournament">
          {data.message}
        </Alert>
      </div>
    )
  }

  if (state.status === 'loading' || data.status !== 'ready') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={6} />
        </div>
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
            <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  const { rows } = state
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

  return (
    <div className={s.page}>
      {header}
      <div className={l.table}>
        <div className={l.headRow}>
          <span>#</span>
          <span />
          <span />
          <span>Player</span>
          <span className={l.headPts}>Pts</span>
        </div>
        {rows.map((entry, i) => (
          <div key={`${entry.displayName}-${i}`} ref={entry.isYou ? youRow : undefined}>
            <LeaderboardRow
              rank={entry.rank}
              name={entry.displayName}
              points={entry.totalPoints}
              isYou={entry.isYou}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
