import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useState } from 'react'
import type { MatchTeam } from '../../design-system'
import { useAuth } from '../auth/AuthProvider'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { rankLeaderboard } from '../../domain/tournament/rankLeaderboard'
import {
  catchUpSummary,
  homePhase,
  pointsToday,
  selectBestLeague,
  type CatchUp,
  type HomePhase,
  type LeagueStanding,
} from '../../domain/tournament/homeDashboard'
import { fetchLeaderboard } from '../../services/supabase/leaderboard'
import { fetchLeagueMembers, fetchMyLeagues } from '../../services/supabase/leagues'
import { fetchMyScoreEventPoints } from '../../services/supabase/scoring'
import { fetchLastSeenRead, updateLastSeen } from '../../services/supabase/profile'
import { computeHubStatus } from '../predict/hubStatus'
import { buildBracketPipeline } from '../bracket'
import { todayISO } from '../../app/time'

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

/**
 * Fetches and assembles the phase-aware Home model. Core tournament and entry
 * data remains a hard requirement. During-tournament dashboard sources may fail
 * independently, but their unavailable state is preserved explicitly rather
 * than being converted into zero points, zero entries or no leagues.
 */
export function useHomeData(): HomeState {
  const { userId, displayName } = useAuth()
  const data = useTournamentData()
  const preds = usePredictions()
  const [state, setState] = useState<HomeState>({ status: 'loading' })

  const ready = data.status === 'ready' && preds.ready
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
    setState({ status: 'loading' })

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

    const hasResults = td.matches.some((match) => match.homeScore !== null)
    const submitted = preds.submittedAt !== null
    const phase = homePhase({ hasResults, submitted })

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

    const today = todayISO()
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
      lockAt: td.tournament.lockAt,
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
        const ranked = rankLeaderboard(await fetchLeaderboard(tournamentId!))
        const you = ranked.find((row) => row.isYou)
        totalPoints = you?.totalPoints ?? 0
        entryCount = ranked.length
        const preResults = ranked.every((row) => row.rank === null)
        rank = preResults ? null : (you?.rank ?? null)
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
        const standings: LeagueStanding[] = []
        let memberReadFailed = false

        for (const league of leagues) {
          try {
            const members = await fetchLeagueMembers(league.id)
            const rankedMembers = rankLeaderboard(members)
            const meInLeague = rankedMembers.find((member) => member.isYou)
            const topPoints = rankedMembers.reduce(
              (max, member) => Math.max(max, member.totalPoints),
              0,
            )
            const lastActivityMs = members.reduce(
              (max, member) => Math.max(max, Date.parse(member.joinedAt) || 0),
              0,
            )
            standings.push({
              id: league.id,
              name: league.name,
              memberCount: league.memberCount,
              rank: meInLeague?.rank ?? null,
              gapToTop: meInLeague ? topPoints - meInLeague.totalPoints : null,
              lastActivityMs,
            })
          } catch {
            memberReadFailed = true
          }
        }

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
        catchUp,
        hasAnyLeague,
        unavailable: [...unavailable],
      }
    }

    loadDuring()
      .then((model) => {
        if (active) setState({ status: 'ready', model })
      })
      .catch((error) => {
        if (active)
          setState({
            status: 'error',
            message: userFacingError(
              error,
              'Could not load your dashboard. Please try again.',
            ),
          })
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tournamentId, userId, data.status])

  return state
}
