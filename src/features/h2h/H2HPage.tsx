import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton, type MatchTeam } from '../../design-system'
import { ChevronLeftIcon } from '../../design-system/icons'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import {
  computeEntryStats,
  whereYouSplit,
  type EntryPredictions,
  type H2HActuals,
} from '../../domain/tournament/h2h'
import {
  computeBracketHealth,
  deriveKnockoutState,
} from '../../domain/tournament/bracketHealth'
import {
  authoritativeMatchScore,
} from '../../domain/tournament/authoritativeMatchResult'
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'
import { fetchRivalEntry } from '../../services/supabase/h2h'
import { fetchLeaderboardPage } from '../../services/supabase/leaderboard'
import {
  fetchH2HRankHistory,
  type H2HRankHistory,
} from '../../services/supabase/h2hRankHistory'
import { H2HScreen, type H2HPlayerView, type H2HSplitView } from './H2HScreen'
import { RankHistoryComparison } from './RankHistoryComparison'
import s from '../shared.module.css'

const STAGE_UP: Record<string, KnockoutStage> = {
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'FINAL',
  champion: 'CHAMPION',
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; you: H2HPlayerView; rival: H2HPlayerView; split: H2HSplitView }

type HistoryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: H2HRankHistory }

export function H2HPage() {
  const { rivalId } = useParams<{ rivalId: string }>()
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const data = useTournamentData()
  const preds = usePredictions()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [historyState, setHistoryState] = useState<HistoryState>({ status: 'loading' })
  const [historyReloadKey, setHistoryReloadKey] = useState(0)

  const ready = data.status === 'ready' && preds.ready
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  const derived = useMemo(() => {
    if (data.status !== 'ready' || !preds.ready) return null
    const td = data.data
    const teamsById = new Map(td.teams.map((team) => [team.id, team]))
    const teamOf = (id: string | null): MatchTeam => ({
      name: id ? (teamsById.get(id)?.name ?? 'TBC') : 'TBC',
      countryCode: '',
    })

    const groupMatches = td.matches.filter((match) => match.round === 'group')
    const resultsByMatch = new Map<string, { home: number; away: number }>()
    const playedByGroup = new Map<string, number>()
    for (const match of groupMatches) {
      const result = authoritativeMatchScore(match)
      if (result) {
        resultsByMatch.set(match.id, result)
        if (match.groupId) {
          playedByGroup.set(match.groupId, (playedByGroup.get(match.groupId) ?? 0) + 1)
        }
      }
    }
    const undecidedGroupCount = td.groups.filter(
      (group) => (playedByGroup.get(group.id) ?? 0) < 6,
    ).length

    const knockoutState = deriveKnockoutState({
      teamIds: td.teams.map((team) => team.id),
      matches: td.matches.map((match) => ({
        round: match.round,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        winnerTeamId: match.winnerTeamId ?? null,
        resulted:
          match.round === 'group'
            ? authoritativeMatchScore(match) !== null
            : Boolean(match.winnerTeamId),
      })),
    })

    const actuals: H2HActuals = {
      resultsByMatch,
      undecidedGroupCount,
      eliminatedTeamIds: knockoutState.eliminatedTeamIds,
    }

    const ownPreds: EntryPredictions = {
      groupMatches: groupMatches.flatMap((match) => {
        const prediction = preds.getPrediction(match.id)
        return prediction.homeScore !== null && prediction.awayScore !== null
          ? [{
              matchId: match.id,
              homeScore: prediction.homeScore,
              awayScore: prediction.awayScore,
              joker: Boolean(prediction.joker),
            }]
          : []
      }),
      progression: Object.entries(preds.bracketProgression).map(([teamId, stage]) => ({
        teamId,
        stage: STAGE_UP[stage],
      })),
    }

    return {
      actuals,
      ownPreds,
      teamOf,
      knockoutState,
      locked: isEntryLocked(td.tournament.lockAt),
    }
  }, [data, preds])

  useEffect(() => {
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!ready || !tournamentId || !rivalId || !derived) {
      setState({ status: 'loading' })
      return
    }

    let active = true
    setState({ status: 'loading' })
    const { actuals, ownPreds, teamOf, knockoutState } = derived

    Promise.all([
      fetchRivalEntry(rivalId, tournamentId),
      fetchLeaderboardPage(tournamentId, { limit: 1 }),
    ])
      .then(([rival, leaderboard]) => {
        if (!active) return
        const youStats = computeEntryStats(ownPreds, actuals)
        const rivalStats = computeEntryStats(rival.predictions, actuals)
        const split = whereYouSplit(ownPreds, rival.predictions)
        const championTeam = (progression: EntryPredictions['progression']): MatchTeam | null => {
          const id = progression.find((prediction) => prediction.stage === 'CHAMPION')?.teamId
          return id ? teamOf(id) : null
        }
        const eliminated = (id: string) => knockoutState.eliminatedTeamIds.has(id)

        setState({
          status: 'ready',
          you: {
            displayName: displayName ?? 'You',
            champion: championTeam(ownPreds.progression),
            championEliminated: ownPreds.progression.some(
              (prediction) => prediction.stage === 'CHAMPION' && eliminated(prediction.teamId),
            ),
            ...youStats,
            totalPoints: leaderboard.you?.totalPoints ?? 0,
            bracketHealth: computeBracketHealth(ownPreds.progression, knockoutState),
          },
          rival: {
            displayName: rival.displayName,
            champion: championTeam(rival.predictions.progression),
            championEliminated: rival.predictions.progression.some(
              (prediction) => prediction.stage === 'CHAMPION' && eliminated(prediction.teamId),
            ),
            ...rivalStats,
            totalPoints: rival.totalPoints,
            bracketHealth: computeBracketHealth(rival.predictions.progression, knockoutState),
          },
          split: {
            champion: {
              agree: split.champion.agree,
              mine: split.champion.mineTeamId ? teamOf(split.champion.mineTeamId) : null,
              theirs: split.champion.theirsTeamId ? teamOf(split.champion.theirsTeamId) : null,
            },
            sharedFinalists: split.finalists.sharedTeamIds.map(teamOf),
            mineOnlyFinalists: split.finalists.mineOnlyTeamIds.map(teamOf),
            theirsOnlyFinalists: split.finalists.theirsOnlyTeamIds.map(teamOf),
          },
        })
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: userFacingError(error, 'Head-to-head is unavailable. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data.status, derived, displayName, ready, reloadKey, rivalId, tournamentId])

  useEffect(() => {
    if (!ready || !tournamentId || !rivalId) {
      setHistoryState({ status: 'loading' })
      return
    }

    let active = true
    setHistoryState({ status: 'loading' })
    fetchH2HRankHistory(rivalId, tournamentId)
      .then((history) => {
        if (active) setHistoryState({ status: 'ready', data: history })
      })
      .catch((error) => {
        if (active) {
          setHistoryState({
            status: 'error',
            message: userFacingError(error, 'Rank history is unavailable. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [historyReloadKey, ready, rivalId, tournamentId])

  const header = (
    <div className={s.header}>
      <button type="button" className={s.backLink} onClick={() => navigate(-1)}>
        <ChevronLeftIcon size={16} /> Back
      </button>
      <h1 className={s.title}>Head to head</h1>
    </div>
  )

  if (state.status === 'error') {
    return (
      <div className={s.page}>
        {header}
        <Alert variant="warning" title="Head-to-head unavailable">
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
          <Skeleton lines={3} />
        </div>
      </div>
    )
  }

  const rankHistory =
    historyState.status === 'ready' ? (
      <RankHistoryComparison
        youName={state.you.displayName}
        rivalName={state.rival.displayName}
        history={historyState.data}
      />
    ) : historyState.status === 'error' ? (
      <Alert variant="warning" title="Rank history unavailable">
        {historyState.message}
        <div style={{ marginTop: 10 }}>
          <Button
            variant="secondary"
            onClick={() => setHistoryReloadKey((key) => key + 1)}
          >
            Retry rank history
          </Button>
        </div>
      </Alert>
    ) : (
      <div className={s.card} aria-label="Loading rank history">
        <Skeleton lines={4} />
      </div>
    )

  return (
    <div className={s.page}>
      {header}
      <H2HScreen
        you={state.you}
        rival={state.rival}
        split={state.split}
        rankHistory={rankHistory}
      />
      {rivalId && (
        <Button variant="secondary" fullWidth onClick={() => navigate(`/profile/${rivalId}`)}>
          View player profile
        </Button>
      )}
    </div>
  )
}
