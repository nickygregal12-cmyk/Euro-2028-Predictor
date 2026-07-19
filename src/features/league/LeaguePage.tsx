import { useEffect, useRef, useState } from 'react'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { GlobeIcon, TrophyIcon } from '../../design-system/icons'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import {
  rankLeaderboard,
  type RankedEntry,
} from '../../domain/tournament/rankLeaderboard'
import { fetchLeaderboard } from '../../services/supabase/leaderboard'
import { LeaderboardRow } from './LeaderboardRow'
import s from '../shared.module.css'
import l from './leaderboard.module.css'

// League = Original Predictor only (docs/competition-structure.md §2). v0.1 is
// the flat overall leaderboard; private leagues expand this tab at Phase 2.
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: RankedEntry[] }

export function LeaguePage() {
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

  // Scroll the current user's row into view once the table is populated.
  useEffect(() => {
    if (state.status === 'ready') youRow.current?.scrollIntoView({ block: 'center' })
  }, [state.status])

  const header = (
    <div className={s.header}>
      <h1 className={s.title}>League</h1>
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
          <Skeleton lines={2} />
        </div>
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
          description="The overall standings fill up as players submit their predictions. Check back once entries are in."
        />
      </div>
    )
  }

  const you = rows.find((r) => r.isYou)
  // Pre-results: everyone is level (ranks are null), so lead with the entry
  // count rather than a wall of tied 1sts.
  const preResults = rows.every((r) => r.rank === null)
  const yourRank = preResults ? null : (you?.rank ?? null)

  return (
    <div className={s.page}>
      {header}

      {/* Overall standings card (the whole tab at v0.1). */}
      <div className={l.card}>
        <span className={l.globe}>
          <GlobeIcon size={22} />
        </span>
        <span className={l.cardBody}>
          <span className={l.cardTitle}>All players, everywhere</span>
          <span className={l.cardSub}>
            {preResults
              ? `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} submitted · standings once results come in`
              : you
                ? `You're ${ordinal(you.rank as number)} of ${rows.length}`
                : `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`}
          </span>
        </span>
        {yourRank !== null && <span className={l.cardRank}>{ordinal(yourRank)}</span>}
      </div>

      {/* Full ranked table. */}
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

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}
