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

export type HomeModel = {
  phase: HomePhase
  displayName: string | null
  // Stat strip (during)
  totalPoints: number
  pointsToday: number
  rank: number | null
  entryCount: number
  bestLeague: LeagueStanding | null
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
  hasAnyLeague: boolean
  lockAt: string | null
  startsOn: string | null
}

export type HomeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: HomeModel }

/**
 * Fetches and assembles the phase-aware Home model. The during-tournament data
 * (leaderboard, leagues, score events, last-seen) is fetched only once results
 * exist — so the pre-tournament Home works before the scoring/leagues migrations
 * — and each of those fetches fails soft to an empty value, so Home always
 * renders. Pure shaping is delegated to the domain (homeDashboard.ts).
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
        ? { kind: 'next', dateISO: nextDate, fixtures: sorted.filter((m) => m.matchDate === nextDate).map(toFixture) }
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

    // Pre-tournament phases need none of the scored/league data.
    if (phase !== 'during') {
      setState({ status: 'ready', model: baseModel })
      return
    }

    // --- during-tournament data (each fails soft) ----------------------------
    async function loadDuring(): Promise<HomeModel> {
      const matchDateById = new Map(td.matches.map((m) => [m.id, m.matchDate]))

      const leaderboard = await fetchLeaderboard(tournamentId!).catch(() => [])
      const ranked = rankLeaderboard(leaderboard)
      const you = ranked.find((r) => r.isYou)
      const totalPoints = you?.totalPoints ?? 0
      const preResults = ranked.every((r) => r.rank === null)
      const rank = preResults ? null : (you?.rank ?? null)

      const events = await fetchMyScoreEventPoints().catch(() => [])
      const todaysPoints = pointsToday(events, matchDateById, today)

      const leagues = await fetchMyLeagues(tournamentId!).catch(() => [])
      const standings: LeagueStanding[] = []
      for (const lg of leagues) {
        try {
          const members = await fetchLeagueMembers(lg.id)
          const rankedMembers = rankLeaderboard(members)
          const meInLeague = rankedMembers.find((m) => m.isYou)
          const topPoints = rankedMembers.reduce((max, m) => Math.max(max, m.totalPoints), 0)
          const lastActivityMs = members.reduce(
            (max, m) => Math.max(max, Date.parse(m.joinedAt) || 0),
            0,
          )
          standings.push({
            id: lg.id,
            name: lg.name,
            memberCount: lg.memberCount,
            rank: meInLeague?.rank ?? null,
            gapToTop: meInLeague ? topPoints - meInLeague.totalPoints : null,
            lastActivityMs,
          })
        } catch {
          // skip a league we couldn't rank
        }
      }
      const bestLeague = selectBestLeague(standings)

      const seen = await fetchLastSeen(userId!)
      const catchUp = catchUpSummary({
        lastSeenAt: seen.lastSeenAt,
        lastSeenPoints: seen.lastSeenPoints,
        currentPoints: totalPoints,
      })
      // Snapshot for next time (best-effort). Do this AFTER reading the old value.
      void updateLastSeen(userId!, totalPoints)

      return {
        ...baseModel,
        totalPoints,
        pointsToday: todaysPoints,
        rank,
        entryCount: ranked.length,
        bestLeague,
        catchUp,
        hasAnyLeague: leagues.length > 0,
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
            message: e instanceof Error ? e.message : 'Failed to load your dashboard.',
          })
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tournamentId, userId, data.status])

  return state
}
