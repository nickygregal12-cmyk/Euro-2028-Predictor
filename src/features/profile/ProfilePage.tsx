import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
// From the module, not the barrel. `../bracket/index.ts` re-exports the round,
// tie, switcher and champion components as well as the pipeline, so importing
// the pipeline through it pulled four retired bracket SCREENS into the
// production bundle behind one function. `AccountPage` and `useShareModel`
// already reach for the module directly; this was the odd one out.
import { buildBracketPipeline } from '../bracket/bracketPipeline'
import { scoreOneMatch } from '../predict/matchScoring'
import { profileStats, type OutcomeKind } from '../../domain/tournament/profileStats'
import { useTournamentEntryLocked } from '../shared/useTournamentEntryLocked'
import { fetchLeaderboardPage } from '../../services/supabase/leaderboard'
import { fetchMyLeagues } from '../../services/supabase/leagues'
import { fetchMyScoreEvents } from '../../services/supabase/scoring'
import type { ScoreEvent } from '../../domain/tournament/scoreEvents'
import { ProfileScreen, type ProfileFullStats } from './ProfileScreen'
import type { MatchTeam } from '../../design-system'
import s from '../shared.module.css'

export type ProfileDataSource = 'leaderboard' | 'leagues' | 'events'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      champion: MatchTeam | null
      stats: ProfileFullStats
      events: ScoreEvent[]
      leaguesCount: number | null
      unavailable: ProfileDataSource[]
      locked: boolean
    }

export function ProfilePage() {
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const data = useTournamentData()
  const preds = usePredictions()
  const entryLocked = useTournamentEntryLocked()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  const ready = data.status === 'ready' && preds.ready
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  useEffect(() => {
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!ready || !tournamentId || data.status !== 'ready') {
      setState({ status: 'loading' })
      return
    }
    let active = true
    setState({ status: 'loading' })

    const td = data.data
    const locked = entryLocked
    const bracket = buildBracketPipeline(
      td,
      preds.getPrediction,
      preds.tieResolutions,
      preds.bracketProgression,
    )

    const kinds: OutcomeKind[] = []
    for (const match of td.matches) {
      if (
        match.round !== 'group' ||
        match.homeScore === null ||
        match.awayScore === null
      ) {
        continue
      }
      const scored = scoreOneMatch(preds.getPrediction(match.id), {
        home: match.homeScore,
        away: match.awayScore,
      })
      if (scored) kinds.push(scored.kind)
    }
    const derived = profileStats(kinds)

    Promise.allSettled([
      fetchLeaderboardPage(tournamentId, { limit: 1 }),
      fetchMyLeagues(tournamentId),
      fetchMyScoreEvents(),
    ])
      .then(([leaderboardRead, leaguesRead, eventsRead]) => {
        if (!active) return

        const unavailable: ProfileDataSource[] = []
        let totalPoints: number | null = null
        let rank: number | null = null
        let leaguesCount: number | null = null
        let events: ScoreEvent[] = []

        if (leaderboardRead.status === 'fulfilled') {
          const page = leaderboardRead.value
          const preResults = page.totalCount === 0 || page.rows[0]?.rank === null
          totalPoints = page.you?.totalPoints ?? 0
          rank = preResults ? null : (page.you?.rank ?? null)
        } else {
          unavailable.push('leaderboard')
        }

        if (leaguesRead.status === 'fulfilled') {
          leaguesCount = leaguesRead.value.length
        } else {
          unavailable.push('leagues')
        }

        if (eventsRead.status === 'fulfilled') {
          events = eventsRead.value
        } else {
          unavailable.push('events')
        }

        setState({
          status: 'ready',
          champion: bracket.champion ?? null,
          stats: {
            ...derived,
            totalPoints,
            rank,
          },
          events,
          leaguesCount,
          unavailable,
          locked,
        })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(
              error,
              'Could not load your profile. Please try again.',
            ),
          })
        }
      })
    return () => {
      active = false
    }
  }, [data, preds, ready, reloadKey, tournamentId, entryLocked])

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate('/more')}>
        <ChevronLeftIcon size={16} /> More
      </button>
      <h1 className={s.title}>Profile</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load your profile">
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
          <Skeleton lines={3} />
        </div>
        <div className={s.card}>
          <Skeleton lines={4} />
        </div>
      </div>
    )
  }

  // A PROFILE OF ZEROS IS NOT A PROFILE. Every figure below is derived from the
  // caller's predictions, and a visitor with no entry has none — so before this
  // said so, they were shown an accuracy breakdown of nothing, zero points and
  // no rank, all of it perfectly plausible and about nobody. It became the
  // ordinary case the moment the provider stopped creating an entry just
  // because somebody opened this page.
  if (!preds.hasEntry) {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="info" title="Nothing to show here yet">
          Your profile is built from the predictions you have made, and you have
          not entered a competition that reports here. Join a game from your
          competition and this fills in.
        </Alert>
      </div>
    )
  }

  const leaderboardAvailable = !state.unavailable.includes('leaderboard')
  const leaguesAvailable = !state.unavailable.includes('leagues')
  const eventsAvailable = !state.unavailable.includes('events')

  return (
    <div className={s.page}>
      {header}
      {state.unavailable.length > 0 && (
        <Alert variant="warning" title="Some profile data is unavailable">
          Your predictions and locally derived accuracy are unaffected. Missing figures will
          return when the connection recovers.
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry missing data
            </Button>
          </div>
        </Alert>
      )}
      <ProfileScreen
        kind="full"
        header={{
          displayName: displayName ?? 'You',
          isOwn: true,
          champion: state.champion,
          championEliminated: false,
          leaguesCount: state.leaguesCount,
        }}
        stats={state.stats}
        events={state.events}
        availability={{
          leaderboard: leaderboardAvailable,
          leagues: leaguesAvailable,
          events: eventsAvailable,
        }}
        locked={state.locked}
        onEdit={() => navigate('/account')}
      />
    </div>
  )
}
