import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { buildBracketPipeline } from '../bracket'
import { scoreOneMatch } from '../predict/matchScoring'
import { rankLeaderboard } from '../../domain/tournament/rankLeaderboard'
import { profileStats, type OutcomeKind } from '../../domain/tournament/profileStats'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { fetchLeaderboard } from '../../services/supabase/leaderboard'
import { fetchMyLeagues } from '../../services/supabase/leagues'
import { fetchMyScoreEvents } from '../../services/supabase/scoring'
import type { ScoreEvent } from '../../domain/tournament/scoreEvents'
import {
  ProfileScreen,
  type ProfileDataAvailability,
  type ProfileFullStats,
} from './ProfileScreen'
import type { MatchTeam } from '../../design-system'
import s from '../shared.module.css'

// Own profile (via More tab — design-system §6). Viewing ANOTHER player's
// profile is deliberately not wired here: it needs the reveal-after-lock RLS /
// a co-membership, post-lock security-definer read (roadmap Phase 2, unbuilt),
// so no endpoint exposes another user's stats or predictions yet. The
// presentational ProfileScreen already covers the other-player + pre-lock-hidden
// states (see /dev/components) for when that lands.
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      champion: MatchTeam | null
      stats: ProfileFullStats
      events: ScoreEvent[] | null
      leaguesCount: number | null
      availability: ProfileDataAvailability
      locked: boolean
    }

export function ProfilePage() {
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const data = useTournamentData()
  const preds = usePredictions()
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
    const locked = isEntryLocked(td.tournament.lockAt)
    const bracket = buildBracketPipeline(
      td,
      preds.getPrediction,
      preds.tieResolutions,
      preds.bracketProgression,
    )

    // Exact / accuracy from the user's own resulted group predictions (domain
    // scorer — same rules as score_events). These local values remain available
    // even when an independent remote profile source fails.
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

    async function loadProfile(): Promise<Extract<State, { status: 'ready' }>> {
      const [leaderboardResult, leaguesResult, eventsResult] = await Promise.allSettled([
        fetchLeaderboard(tournamentId!),
        fetchMyLeagues(tournamentId!),
        fetchMyScoreEvents(),
      ])

      const availability: ProfileDataAvailability = {
        leaderboard: leaderboardResult.status === 'fulfilled',
        leagues: leaguesResult.status === 'fulfilled',
        scoreEvents: eventsResult.status === 'fulfilled',
      }

      let totalPoints: number | null = null
      let rank: number | null = null
      if (leaderboardResult.status === 'fulfilled') {
        const ranked = rankLeaderboard(leaderboardResult.value)
        const you = ranked.find((row) => row.isYou)
        const preResults = ranked.every((row) => row.rank === null)
        totalPoints = you?.totalPoints ?? 0
        rank = preResults ? null : (you?.rank ?? null)
      }

      return {
        status: 'ready',
        champion: bracket.champion ?? null,
        stats: {
          ...derived,
          totalPoints,
          rank,
        },
        events: eventsResult.status === 'fulfilled' ? eventsResult.value : null,
        leaguesCount:
          leaguesResult.status === 'fulfilled' ? leaguesResult.value.length : null,
        availability,
        locked,
      }
    }

    loadProfile()
      .then((nextState) => {
        if (active) setState(nextState)
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(error, 'Could not load your profile. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tournamentId, data.status, reloadKey])

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

  return (
    <div className={s.page}>
      {header}
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
        availability={state.availability}
        locked={state.locked}
        onViewEntry={() => navigate('/predict/review')}
      />
    </div>
  )
}
