import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { ChevronLeftIcon, TrophyIcon } from '../../design-system/icons'
import type { ScoreEvent } from '../../domain/tournament/scoreEvents'
import { fetchMyScoreEvents } from '../../services/supabase/scoring'
import { PointsBreakdown } from './PointsBreakdown'
import s from '../shared.module.css'

// The interim home for the Points breakdown (design-system §6): a "My points"
// view under More, driven by the user's real score_events. Moves to the profile
// page when that's built. Totals appear once results are entered and the DB
// recompute runs (20260720130000_add_scoring.sql).
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: ScoreEvent[] }

export function MyPointsPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    fetchMyScoreEvents()
      .then((events) => {
        if (active) setState({ status: 'ready', events })
      })
      .catch((e) => {
        if (active)
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Failed to load your points.',
          })
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/more')}>
        <ChevronLeftIcon size={16} /> More
      </button>
      <h1 className={s.title}>My points</h1>
      <p className={s.sub}>Your running score, broken down by category.</p>
    </div>
  )

  if (state.status === 'loading') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={5} />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load your points">
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

  if (state.events.length === 0) {
    return (
      <div className={s.page}>
        {header}
        <EmptyState
          icon={<TrophyIcon size={22} />}
          title="No points yet"
          description="Your points appear here as group results come in and are scored."
        />
      </div>
    )
  }

  return (
    <div className={s.page}>
      {header}
      <PointsBreakdown events={state.events} defaultExpanded />
    </div>
  )
}
