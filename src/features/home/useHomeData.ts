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
import { fetchLastSeen, updateLastSeen } from '../../services/supabase/profile'
import { computeHubStatus } from '../predict/hubStatus'
import { buildBracketPipeline } from '../bracket'
import { todayISO } from '../../app/time'

// A fixture shown in the Today card. `live` stays false until a live-score data
// source exists (Phase 3) — there's no minute/live flag in the schema yet.
export type TodayFixture = {
  matchId: string
  matchRef: string
  group: string // group letter, or '' for knockout
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
  // Stat strip (during). Null means the source was unavailable, never zero.
  totalPoints: number | null
  pointsToday: number | null
  rank: number | null
  entryCount: number | null
  bestLeague: LeagueStanding | null
  unavailable: HomeDataSource[]
  // Today card
  today: TodaySection
  // Catch-up
  catchUp: CatchUp | null
  // Pre-tournament
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
    const teamsById = new Map(td.teams.map((t) => [t.id, t]))
    const letterByGroupId = new Map(td.groups.map((g) => [g.id, g.letter]))
    const teamOf = (id: string | null): MatchTeam => ({
      name: id ? (teamsById.get(id)?.name ?? 'TBC') : 'TBC',
      countryCode: '',
    })
    const toFixture = (m: (typeof td.matches)[number]): TodayFixture => {
      const p = preds.getPrediction(m.id)
      return {
        matchId: m.id,
        matchRef: m.matchRef,
        group: m.groupId ? (letterByGroupId.get(m.groupId) ?? '') : '',
        matchday: m.matchday,
        home: teamOf(m.homeTeamId),
        away: teamOf(m.awayTeamId),
        kickoffAt: m.kickoffAt,
        matchDate: m.matchDate,
        prediction:
          p.homeScore !== null && p.awayScore !== null
            ? { home: p.homeScore, away: p.awayScore }
            : null,
        result:
          m.homeScore !== null && m.awayScore !== null
            ? { home: m.homeScore, away: m.awayScore }
            : null,
        live: false,
      }
    }

    // --- synchronous shaping (no DB) -----------------------------------------
    const hasResults = td.matches.some((m) => m.homeScore !== null)
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

    // Today's fixtures, or the next matchday if none today.
    const today = todayISO()
    const sorted = [...td.matches].sort(
      (a, b) =>
        a.matchDate.localeCompare(b.matchDate) ||
        (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? '') ||
        a.matchRef.localeCompare(b.matchRef),
    )
    const todays = sorted.filter((m) => m.matchDate === today)
    let todaySection: TodaySection
    if (todays.length > 0) {
      const fixtures = todays.map(toFixture)
      todaySection = { kind: 'today', fixtures, anyLive: fixtures.some((f) => f.live) }
    } else {
      const nextDate = sorted.find((m) => m.matchDate > today)?.matchDate
      todaySection = nextDate
        ? {
            kind: 'next',
            dateISO: nextDate,
            fixtures: sorted.filter((m) => m.matchDate === nextDate).map(toFixture),
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

    // Pre-tournament phases do not render scored dashboard statistics.
    if (phase !== 'during') {
      setState({ status: 'ready', model: baseModel })
      return
    }

    // --- during-tournament data (independent availability) -------------------
    async function loadDuring(): Promise<HomeModel> {
      const matchDateById = new Map(td.matches.map((m) => [m.id, m.matchDate]))
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
        try {
          const seen = await fetchLastSeen(userId!)
          catchUp = catchUpSummary({
            lastSeenAt: seen.lastSeenAt,
            lastSeenPoints: seen.lastSeenPoints,
            currentPoints: totalPoints,
          })
          // Snapshot for next time after reading the previous value. A failed
          // best-effort update must not erase the successfully loaded snapshot.
          void updateLastSeen(userId!, totalPoints).catch(() => undefined)
        } catch {
          unavailable.add('catchUp')
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
      .catch((e) => {
        if (active)
          setState({
            status: 'error',
            message: userFacingError(e, 'Could not load your dashboard. Please try again.'),
          })
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tournamentId, userId, data.status])

  return state
}
