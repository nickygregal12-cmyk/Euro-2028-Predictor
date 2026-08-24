import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useRef, useState } from 'react'
import type { MatchTeam } from '../../design-system'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import {
  catchUpSummary,
  pointsToday,
  selectBestLeague,
  type CatchUp,
  type HomePhase,
  type LeagueStanding,
} from '../../domain/tournament/homeDashboard'
import { fetchLeaderboardPage } from '../../services/supabase/leaderboard'
import { useLiveResultsVersion } from '../../app/providers/liveResultsContext'
import {
  fetchLeagueMembersPage,
  fetchMyLeagues,
} from '../../services/supabase/leagues'
import { fetchMyScoreEventPoints } from '../../services/supabase/scoring'
import { fetchLastSeenRead, updateLastSeen } from '../../services/supabase/profile'
import { computeHubStatus } from '../predict/hubStatus'
import { buildBracketPipeline } from '../bracket/bracketPipeline'
import { todayISO } from '../../app/time'
import { resolveHomeCompetitionContext } from './homeCompetitionContext'
import { loadLeagueStandingsConcurrently } from './loadLeagueStandings'

export type TodayFixture = {
  matchId: string
  matchRef: string
  group: string
  matchday: number | null
  home: MatchTeam
  away: MatchTeam
  kickoffAt: string | null
  matchDate: string
  prediction: { home: number; away: number } | null
  result: { home: number; away: number } | null
  live: boolean
}

export type TodaySection =
  | { kind: 'today'; fixtures: TodayFixture[]; anyLive: boolean }
  | { kind: 'next'; dateISO: string; fixtures: TodayFixture[] }
  | { kind: 'none' }

export type HomeDataSource = 'leaderboard' | 'scoreEvents' | 'leagues' | 'catchUp'

export type HomeModel = {
  phase: HomePhase
  displayName: string | null
  totalPoints: number | null
  pointsToday: number | null
  rank: number | null
  entryCount: number | null
  bestLeague: LeagueStanding | null
  unavailable: HomeDataSource[]
  today: TodaySection
  catchUp: CatchUp | null
  entryPercent: number
  groupsPredicted: number
  groupsTotal: number
  submitted: boolean
  champion: MatchTeam | null
  hasAnyLeague: boolean | null
  lockAt: string | null
  startsOn: string | null
}

export type HomeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: HomeModel }

export function useHomeData(): HomeState {
  const { userId, displayName } = useAuth()
  const data = useTournamentData()
  const preds = usePredictions()
  const [state, setState] = useState<HomeState>({ status: 'loading' })
  const stateRef = useRef(state)
  stateRef.current = state

  const ready = data.status === 'ready' && preds.ready
  // ADR 0008: advances when the server says results moved, so Home's own-standing
  // card refetches from get_leaderboard instead of waiting for a manual refresh.
  const resultsVersion = useLiveResultsVersion()
  const tournamentId = data.status === 'ready' ? data.data.tournament.id : null

  useEffect(() => {
    if (data.status === 'error') {
      setState({ status: 'error', message: data.message })
      return
    }
    if (!ready || !tournamentId || !userId || data.status !== 'ready') {
      setState({ status: 'loading' })
      return
    }
    let active = true
    // A refresh of an already-rendered Home must not blank it. This runs again
    // whenever results move (ADR 0008), and replacing a populated page with a
    // skeleton every time a goal is confirmed would be worse than not being
    // live at all. Same rule TournamentDataProvider already follows.
    const isBackgroundRefresh = stateRef.current.status === 'ready'
    if (!isBackgroundRefresh) setState({ status: 'loading' })

    const td = data.data
    const teamsById = new Map(td.teams.map((team) => [team.id, team]))
    const letterByGroupId = new Map(td.groups.map((group) => [group.id, group.letter]))
    const teamOf = (id: string | null): MatchTeam => ({
      name: id ? (teamsById.get(id)?.name ?? 'TBC') : 'TBC',
      countryCode: '',
    })
    const toFixture = (match: (typeof td.matches)[number]): TodayFixture => {
      const prediction = preds.getPrediction(match.id)
      return {
        matchId: match.id,
        matchRef: match.matchRef,
        group: match.groupId ? (letterByGroupId.get(match.groupId) ?? '') : '',
        matchday: match.matchday,
        home: teamOf(match.homeTeamId),
        away: teamOf(match.awayTeamId),
        kickoffAt: match.kickoffAt,
        matchDate: match.matchDate,
        prediction:
          prediction.homeScore !== null && prediction.awayScore !== null
            ? { home: prediction.homeScore, away: prediction.awayScore }
            : null,
        result:
          match.homeScore !== null && match.awayScore !== null
            ? { home: match.homeScore, away: match.awayScore }
            : null,
        live: false,
      }
    }

    const submitted = preds.submittedAt !== null
    const status = computeHubStatus(
      td,
      preds.getPrediction,
      preds.jokerCount,
      preds.tieResolutions,
      preds.bracketProgression,
    )
    const bracket = buildBracketPipeline(
      td,
      preds.getPrediction,
      preds.tieResolutions,
      preds.bracketProgression,
    )
    const nowServer = new Date()
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const homeCompetition = resolveHomeCompetitionContext({
      data: td,
      submitted,
      entryComplete: status.reviewUnlocked || submitted,
      nowServer,
      viewerTimeZone: timeZone,
      localDateISO: todayISO(nowServer),
    })
    const phase = homeCompetition.phase

    const today = homeCompetition.todayISO
    const sorted = [...td.matches].sort(
      (a, b) =>
        a.matchDate.localeCompare(b.matchDate) ||
        (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? '') ||
        a.matchRef.localeCompare(b.matchRef),
    )
    const todays = sorted.filter((match) => match.matchDate === today)
    let todaySection: TodaySection
    if (todays.length > 0) {
      const fixtures = todays.map(toFixture)
      todaySection = { kind: 'today', fixtures, anyLive: fixtures.some((fixture) => fixture.live) }
    } else {
      const nextDate = sorted.find((match) => match.matchDate > today)?.matchDate
      todaySection = nextDate
        ? {
            kind: 'next',
            dateISO: nextDate,
            fixtures: sorted.filter((match) => match.matchDate === nextDate).map(toFixture),
          }
        : { kind: 'none' }
    }

    const baseModel: HomeModel = {
      phase,
      displayName,
      totalPoints: 0,
      pointsToday: 0,
      rank: null,
      entryCount: 0,
      bestLeague: null,
      unavailable: [],
      today: todaySection,
      catchUp: null,
      entryPercent: status.overallPercent,
      groupsPredicted: status.groups.predicted,
      groupsTotal: status.groups.total,
      submitted,
      champion: bracket.champion ?? null,
      hasAnyLeague: false,
      lockAt: homeCompetition.lockAt,
      startsOn: td.tournament.startsOn,
    }

    if (phase !== 'during') {
      setState({ status: 'ready', model: baseModel })
      return
    }

    async function loadDuring(): Promise<HomeModel> {
      const matchDateById = new Map(td.matches.map((match) => [match.id, match.matchDate]))
      const unavailable = new Set<HomeDataSource>()

      let totalPoints: number | null = null
      let rank: number | null = null
      let entryCount: number | null = null
      try {
        const page = await fetchLeaderboardPage(tournamentId!, { limit: 1 })
        const preResults = page.totalCount === 0 || page.rows[0]?.rank === null
        totalPoints = page.you?.totalPoints ?? 0
        entryCount = page.totalCount
        rank = preResults ? null : (page.you?.rank ?? null)
      } catch {
        unavailable.add('leaderboard')
      }

      let todaysPoints: number | null = null
      try {
        const events = await fetchMyScoreEventPoints()
        todaysPoints = pointsToday(events, matchDateById, today)
      } catch {
        unavailable.add('scoreEvents')
      }

      let bestLeague: LeagueStanding | null = null
      let hasAnyLeague: boolean | null = null
      try {
        const leagues = await fetchMyLeagues(tournamentId!)
        hasAnyLeague = leagues.length > 0
        const { standings, memberReadFailed } = await loadLeagueStandingsConcurrently(
          leagues,
          (leagueId) => fetchLeagueMembersPage(leagueId, { limit: 1 }),
        )

        if (memberReadFailed) unavailable.add('leagues')
        bestLeague = selectBestLeague(standings)
      } catch {
        unavailable.add('leagues')
      }

      let catchUp: CatchUp | null = null
      if (totalPoints === null) {
        unavailable.add('catchUp')
      } else {
        const seen = await fetchLastSeenRead(userId!)
        if (!seen.available) {
          unavailable.add('catchUp')
        } else {
          catchUp = catchUpSummary({
            lastSeenAt: seen.value.lastSeenAt,
            lastSeenPoints: seen.value.lastSeenPoints,
            currentPoints: totalPoints,
          })
          void updateLastSeen(userId!, totalPoints)
        }
      }

      return {
        ...baseModel,
        totalPoints,
        pointsToday: todaysPoints,
        rank,
        entryCount,
        bestLeague,
        unavailable: [...unavailable],
        catchUp,
        hasAnyLeague,
      }
    }

    void loadDuring()
      .then((model) => {
        if (active) setState({ status: 'ready', model })
      })
      .catch((error) => {
        // A failed background refresh keeps the good page the player is looking
        // at. Only a first load has nothing to fall back to.
        if (active && !isBackgroundRefresh) {
          setState({
            status: 'error',
            message: userFacingError(error, 'Could not load Home. Please try again.'),
          })
        }
      })

    return () => {
      active = false
    }
  }, [data, displayName, preds, ready, tournamentId, userId, resultsVersion])

  return state
}
