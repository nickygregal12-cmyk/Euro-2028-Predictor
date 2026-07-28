// The tournament-info pipeline: from confirmed results in TournamentData to
// the Matches tab's Tables / Bracket / Stats sub-view models. It shapes inputs
// and outputs only — standings come from the same pure domain the predictor
// uses (resolveGroupTies / rankThirdPlacedTeams) fed REAL results instead of
// predictions (design-system §Matches), records from computeTournamentStats,
// and knockout state from the server-owned result fields. Nothing here ever
// reads a prediction: Matches shows what's happening, not what you said.

import { resolveGroupTies } from '../../domain/tournament/resolveGroupTies'
import {
  rankThirdPlacedTeams,
  type ThirdPlacedTeam,
} from '../../domain/tournament/rankThirdPlacedTeams'
import {
  authoritativeMatchScore,
  authoritativeWinnerSide,
  knockoutResultDetail,
  type MatchWinnerSide,
} from '../../domain/tournament/authoritativeMatchResult'
import {
  computeTournamentStats,
  describeMatchSource,
  type SettledResult,
} from '../../domain/tournament/tournamentInfo'
import type { MatchScore } from '../../domain/tournament/calculateGroupTable'
import type { Match, TournamentData } from '../../services/supabase/tournamentData'
import type { GroupTableRow, ThirdPlaceRow } from '../../design-system'
import { formatShortDate } from '../../app/time'

// --- Tables ---------------------------------------------------------------

export type LiveGroupTable = {
  letter: string
  caption: string // 'Group A'
  rows: GroupTableRow[]
}

export type LiveTablesView = {
  groups: LiveGroupTable[]
  // Ranked best-thirds — null until any group result exists (an all-tied
  // ranking of untouched teams would be noise, not information).
  thirds: ThirdPlaceRow[] | null
  playedCount: number
  totalCount: number
  // True when any displayed order contains teams the criteria can't separate
  // yet — the view says so instead of implying a settled order.
  hasUnresolvedTies: boolean
}

export function buildLiveTablesView(data: TournamentData): LiveTablesView {
  const nameById = new Map(data.teams.map((t) => [t.id, t.name]))
  const groupMatches = data.matches.filter((m) => m.round === 'group')
  const groups = [...data.groups].sort((a, b) => a.letter.localeCompare(b.letter))

  let playedCount = 0
  let hasUnresolvedTies = false
  const thirds: ThirdPlacedTeam[] = []
  const tables: LiveGroupTable[] = []

  for (const g of groups) {
    const teamIds = data.teams
      .filter((t) => t.groupId === g.id)
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.id)

    const scores: MatchScore[] = []
    for (const m of groupMatches) {
      if (m.groupId !== g.id || !m.homeTeamId || !m.awayTeamId) continue
      const score = authoritativeMatchScore(m)
      if (!score) continue
      scores.push({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeScore: score.home,
        awayScore: score.away,
      })
    }
    playedCount += scores.length

    // Real results only, no manual resolutions: a tie the criteria can't
    // break yet stays visibly shared rather than being invented.
    const { standings } = resolveGroupTies(teamIds, scores)
    if (standings.some((s) => s.tiedUnresolved)) hasUnresolvedTies = true

    tables.push({
      letter: g.letter,
      caption: `Group ${g.letter}`,
      rows: standings.map((s) => ({
        position: s.rank,
        team: { name: nameById.get(s.teamId) ?? s.teamId, countryCode: '' },
        played: s.played,
        goalDifference: s.goalDifference,
        points: s.points,
      })),
    })

    const third = standings[2]
    if (third) thirds.push({ ...third, groupLetter: g.letter })
  }

  let thirdRows: ThirdPlaceRow[] | null = null
  if (playedCount > 0 && thirds.length === groups.length) {
    const ranked = rankThirdPlacedTeams(thirds)
    if (ranked.ranking.some((r) => r.tiedUnresolved)) hasUnresolvedTies = true
    thirdRows = ranked.ranking.map((standing, index) => ({
      position: index + 1,
      groupLetter: standing.groupLetter,
      team: { name: nameById.get(standing.teamId) ?? standing.teamId, countryCode: '' },
      played: standing.played,
      goalDifference: standing.goalDifference,
      points: standing.points,
    }))
  }

  return {
    groups: tables,
    thirds: thirdRows,
    playedCount,
    totalCount: groupMatches.length,
    hasUnresolvedTies,
  }
}

// --- Bracket --------------------------------------------------------------

export type BracketSideVM = {
  // Resolved team name, or the slot description ('Winner Group A') while the
  // side is still to be decided.
  name: string
  known: boolean
}

export type BracketTieVM = {
  ref: string
  dateLabel: string
  venue: string
  home: BracketSideVM
  away: BracketSideVM
  score: { home: number; away: number } | null
  // 'Spain won on penalties' — the authoritative decided-by line.
  detail: string | null
  winner: MatchWinnerSide | null
}

export type BracketRoundVM = {
  key: string
  label: string
  ties: BracketTieVM[]
}

const KO_ROUNDS: { key: string; label: string }[] = [
  { key: 'r16', label: 'Round of 16' },
  { key: 'qf', label: 'Quarter-finals' },
  { key: 'sf', label: 'Semi-finals' },
  { key: 'final', label: 'Final' },
]

// 'R16-10' sorts after 'R16-9' — compare the numeric suffix, not the string.
function refOrder(ref: string): number {
  const n = /(\d+)$/.exec(ref)
  return n ? Number(n[1]) : 0
}

export function buildBracketView(data: TournamentData): BracketRoundVM[] {
  const nameById = new Map(data.teams.map((t) => [t.id, t.name]))

  const sideOf = (teamId: string | null, source: string): BracketSideVM =>
    teamId
      ? { name: nameById.get(teamId) ?? teamId, known: true }
      : { name: describeMatchSource(source), known: false }

  const tieOf = (m: Match): BracketTieVM => ({
    ref: m.matchRef,
    dateLabel: formatShortDate(m.matchDate),
    venue: m.venue,
    home: sideOf(m.homeTeamId, m.homeSource),
    away: sideOf(m.awayTeamId, m.awaySource),
    score: authoritativeMatchScore(m),
    detail: knockoutResultDetail(
      m,
      nameById.get(m.homeTeamId ?? '') ?? '',
      nameById.get(m.awayTeamId ?? '') ?? '',
    ),
    winner: authoritativeWinnerSide(m),
  })

  return KO_ROUNDS.map((round) => ({
    key: round.key,
    label: round.label,
    ties: data.matches
      .filter((m) => m.round === round.key)
      .sort((a, b) => refOrder(a.matchRef) - refOrder(b.matchRef))
      .map(tieOf),
  })).filter((round) => round.ties.length > 0)
}

// --- Stats ----------------------------------------------------------------

export type StatsRecordVM = {
  label: string
  // 'Spain 5–0 Albania · QF-1'
  value: string
}

export type StatsTeamGoalsVM = { name: string; goals: number; played: number }

export type StatsView = {
  played: number
  totalMatches: number
  totalGoals: number
  goalsPerMatch: number | null
  // Group-stage goals so far — the real half of the awards race. The caller
  // supplies the user's derived predicted total separately (that half comes
  // from the entry, not from here).
  groupGoals: { total: number; played: number; matchCount: number }
  records: StatsRecordVM[]
  topTeams: StatsTeamGoalsVM[]
}

const TOP_TEAM_COUNT = 5

export function buildStatsView(data: TournamentData): StatsView {
  const nameById = new Map(data.teams.map((t) => [t.id, t.name]))
  const nameOf = (teamId: string) => nameById.get(teamId) ?? teamId

  const results: SettledResult[] = []
  let groupGoalsTotal = 0
  let groupPlayed = 0
  let groupMatchCount = 0

  for (const m of data.matches) {
    if (m.round === 'group') groupMatchCount += 1
    if (!m.homeTeamId || !m.awayTeamId) continue
    const score = authoritativeMatchScore(m)
    if (!score) continue
    results.push({
      matchRef: m.matchRef,
      round: m.round,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      home: score.home,
      away: score.away,
    })
    if (m.round === 'group') {
      groupGoalsTotal += score.home + score.away
      groupPlayed += 1
    }
  }

  const stats = computeTournamentStats(results)

  const recordValue = (r: SettledResult) =>
    `${nameOf(r.homeTeamId)} ${r.home}–${r.away} ${nameOf(r.awayTeamId)}`

  const records: StatsRecordVM[] = []
  if (stats.biggestWin) {
    records.push({ label: 'Biggest win', value: recordValue(stats.biggestWin) })
  }
  if (stats.highestScoring) {
    records.push({
      label: 'Highest-scoring match',
      value: recordValue(stats.highestScoring),
    })
  }

  return {
    played: stats.played,
    totalMatches: data.matches.length,
    totalGoals: stats.totalGoals,
    goalsPerMatch: stats.goalsPerMatch,
    groupGoals: { total: groupGoalsTotal, played: groupPlayed, matchCount: groupMatchCount },
    records,
    topTeams: stats.teamGoals
      .slice(0, TOP_TEAM_COUNT)
      .map((t) => ({ name: nameOf(t.teamId), goals: t.goals, played: t.played })),
  }
}
