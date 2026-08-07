import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton, type MatchTeam } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { authoritativeMatchScore, eliminatedKnockoutTeamId } from '../../domain/tournament/authoritativeMatchResult'
import { profileStats, type OutcomeKind } from '../../domain/tournament/profileStats'
import { fetchPlayerProfile, type PlayerProfileRead } from '../../services/supabase/playerProfile'
import { scoreOneMatch } from '../predict/matchScoring'
import { ProfileScreen, type ProfileFullStats } from './ProfileScreen'
import s from '../shared.module.css'

const CHAMPION_STAGE = 'CHAMPION'
const SAFE_PLAYER_PARENT = '/leagues'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: PlayerProfileRead }

function lockDateLabel(lockAt: string | null): string {
  if (!lockAt) return 'the published deadline'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(lockAt))
}

function returnPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) {
    return SAFE_PLAYER_PARENT
  }
  const value = (state as { returnTo?: unknown }).returnTo
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : SAFE_PLAYER_PARENT
}

export function OtherPlayerProfilePage() {
  const { playerId } = useParams<{ playerId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const parent = returnPath(location.state)
  const { userId } = useAuth()
  const data = useTournamentData()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null
  const [state, setState] = useState<State>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (playerId && userId && playerId === userId) {
      navigate('/profile', { replace: true })
      return
    }
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!playerId || !tournamentId) {
      setState({ status: 'loading' })
      return
    }

    let active = true
    setState({ status: 'loading' })
    fetchPlayerProfile(playerId, tournamentId)
      .then((profile) => {
        if (active) setState({ status: 'ready', profile })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(
              error,
              'This player profile is unavailable. Please try again.',
            ),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data.status, navigate, playerId, reloadKey, tournamentId, userId])

  const derived = useMemo(() => {
    if (data.status !== 'ready' || state.status !== 'ready' || !state.profile.detail) {
      return null
    }

    const td = data.data
    const detail = state.profile.detail
    const predictionByMatch = new Map(
      detail.predictions.groupMatches.map((prediction) => [prediction.matchId, prediction]),
    )
    const kinds: OutcomeKind[] = []

    for (const match of td.matches) {
      if (match.round !== 'group') continue
      const actual = authoritativeMatchScore(match)
      const prediction = predictionByMatch.get(match.id)
      if (!actual || !prediction) continue
      const scored = scoreOneMatch(prediction, actual)
      if (scored) kinds.push(scored.kind)
    }

    const stats: ProfileFullStats = {
      ...profileStats(kinds),
      totalPoints: detail.totalPoints,
      rank: detail.rank,
    }

    const championId = detail.predictions.progression.find(
      (prediction) => prediction.stage === CHAMPION_STAGE,
    )?.teamId
    const championTeam = championId
      ? td.teams.find((team) => team.id === championId)
      : undefined
    const champion: MatchTeam | null = championTeam
      ? { name: championTeam.name, countryCode: '' }
      : null
    const eliminated = new Set(
      td.matches.map(eliminatedKnockoutTeamId).filter((id): id is string => Boolean(id)),
    )

    return {
      stats,
      champion,
      championEliminated: Boolean(championId && eliminated.has(championId)),
    }
  }, [data, state])

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate(parent)}>
        <ChevronLeftIcon size={16} /> Back
      </button>
      <h1 className={s.title}>Player profile</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="error" title="Couldn't load this profile">
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

  if (state.status === 'loading' || data.status !== 'ready') {
    return (
      <div className={s.page}>
        {header}
        <div className={s.card}>
          <Skeleton lines={3} />
        </div>
        <div className={s.card}>
          <Skeleton lines={5} />
        </div>
      </div>
    )
  }

  const profile = state.profile

  return (
    <div className={s.page}>
      {header}
      {!profile.locked ? (
        <ProfileScreen
          kind="hidden"
          displayName={profile.displayName}
          leaguesCount={profile.leagueCount}
          hasEntry={profile.hasEntry}
          lockDateLabel={lockDateLabel(profile.lockAt)}
        />
      ) : !profile.hasEntry || !profile.detail || !derived ? (
        <ProfileScreen
          kind="empty"
          displayName={profile.displayName}
          leaguesCount={profile.leagueCount}
        />
      ) : (
        <ProfileScreen
          kind="full"
          header={{
            displayName: profile.displayName,
            isOwn: false,
            champion: derived.champion,
            championEliminated: derived.championEliminated,
            leaguesCount: profile.leagueCount,
          }}
          stats={derived.stats}
          events={profile.detail.events}
          locked
          onH2H={() =>
            navigate(`/h2h/${profile.playerId}`, { state: { returnTo: location.pathname } })
          }
        />
      )}
    </div>
  )
}
