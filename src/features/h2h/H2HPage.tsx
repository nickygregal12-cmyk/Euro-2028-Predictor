import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Skeleton, type MatchTeam } from '../../design-system'
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
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'
import { fetchRivalEntry } from '../../services/supabase/h2h'
import { H2HScreen, type H2HPlayerView, type H2HSplitView } from './H2HScreen'
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

export function H2HPage() {
  const { rivalId } = useParams<{ rivalId: string }>()
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const data = useTournamentData()
  const preds = usePredictions()
  const [state, setState] = useState<State>({ status: 'loading' })

  const ready = data.status === 'ready' && preds.ready
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  // Shared actuals + own predictions (from tournament data + the provider).
  const derived = useMemo(() => {
    if (data.status !== 'ready' || !preds.ready) return null
    const td = data.data
    const teamsById = new Map(td.teams.map((t) => [t.id, t]))
    const teamOf = (id: string | null): MatchTeam => ({
      name: id ? (teamsById.get(id)?.name ?? 'TBC') : 'TBC',
      countryCode: '',
    })

    const groupMatches = td.matches.filter((m) => m.round === 'group')
    const resultsByMatch = new Map<string, { home: number; away: number }>()
    const playedByGroup = new Map<string, number>()
    for (const m of groupMatches) {
      if (m.homeScore !== null && m.awayScore !== null) {
        resultsByMatch.set(m.id, { home: m.homeScore, away: m.awayScore })
        if (m.groupId) playedByGroup.set(m.groupId, (playedByGroup.get(m.groupId) ?? 0) + 1)
      }
    }
    const undecidedGroupCount = td.groups.filter((g) => (playedByGroup.get(g.id) ?? 0) < 6).length
    // Teams knocked out in the knockouts (loser of a resulted KO match). Empty
    // pre-knockout; draws aren't decidable here (penalties not modelled).
    const eliminatedTeamIds = new Set<string>()
    for (const m of td.matches) {
      if (m.round === 'group' || m.homeScore === null || m.awayScore === null) continue
      if (!m.homeTeamId || !m.awayTeamId || m.homeScore === m.awayScore) continue
      eliminatedTeamIds.add(m.homeScore < m.awayScore ? m.homeTeamId : m.awayTeamId)
    }
    const actuals: H2HActuals = { resultsByMatch, undecidedGroupCount, eliminatedTeamIds }

    const ownPreds: EntryPredictions = {
      groupMatches: groupMatches.flatMap((m) => {
        const p = preds.getPrediction(m.id)
        return p.homeScore !== null && p.awayScore !== null
          ? [{ matchId: m.id, homeScore: p.homeScore, awayScore: p.awayScore, joker: Boolean(p.joker) }]
          : []
      }),
      progression: Object.entries(preds.bracketProgression).map(([teamId, stage]) => ({
        teamId,
        stage: STAGE_UP[stage],
      })),
    }
    return { actuals, ownPreds, teamOf, locked: isEntryLocked(td.tournament.lockAt) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.status, preds.ready])

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
    const { actuals, ownPreds, teamOf } = derived

    fetchRivalEntry(rivalId, tournamentId)
      .then((rival) => {
        if (!active) return
        const youStats = computeEntryStats(ownPreds, actuals)
        const rivalStats = computeEntryStats(rival.predictions, actuals)
        const split = whereYouSplit(ownPreds, rival.predictions)
        const championTeam = (prog: EntryPredictions['progression']): MatchTeam | null => {
          const id = prog.find((p) => p.stage === 'CHAMPION')?.teamId
          return id ? teamOf(id) : null
        }
        const elim = (id: string) => actuals.eliminatedTeamIds.has(id)
        setState({
          status: 'ready',
          you: {
            displayName: displayName ?? 'You',
            champion: championTeam(ownPreds.progression),
            championEliminated: ownPreds.progression.some((p) => p.stage === 'CHAMPION' && elim(p.teamId)),
            ...youStats,
          },
          rival: {
            displayName: rival.displayName,
            champion: championTeam(rival.predictions.progression),
            championEliminated: rival.predictions.progression.some((p) => p.stage === 'CHAMPION' && elim(p.teamId)),
            ...rivalStats,
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
      .catch((e) => {
        if (active)
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Head-to-head is unavailable.',
          })
      })
    return () => {
      active = false
    }
  }, [ready, tournamentId, rivalId, derived, data.status, displayName])

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

  return (
    <div className={s.page}>
      {header}
      <H2HScreen you={state.you} rival={state.rival} split={state.split} />
    </div>
  )
}
