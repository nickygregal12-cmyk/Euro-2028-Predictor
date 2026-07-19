// Builds the best-third-placed ranking from the user's predictions via the
// domain layer (resolveGroupTies → rankThirdPlacedTeams). Returns null until
// every group match is predicted, since the ranking is meaningless before then.

import { resolveGroupTies } from '../../domain/tournament/resolveGroupTies'
import {
  rankThirdPlacedTeams,
  type ThirdPlacedTeam,
} from '../../domain/tournament/rankThirdPlacedTeams'
import type { MatchScore } from '../../domain/tournament/calculateGroupTable'
import type { TournamentData } from '../../services/supabase/tournamentData'
import type { Prediction } from '../../app/providers/PredictionsProvider'
import type { ThirdPlaceRow } from '../../design-system'

export function buildThirdPlace(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
): { rows: ThirdPlaceRow[]; tieCount: number } | null {
  const groupMatches = data.matches.filter((m) => m.round === 'group')
  for (const m of groupMatches) {
    const p = getPrediction(m.id)
    if (p.homeScore === null || p.awayScore === null) return null
  }

  const nameById = new Map(data.teams.map((t) => [t.id, t.name]))
  const thirds: ThirdPlacedTeam[] = []

  for (const g of data.groups) {
    const teamIds = data.teams
      .filter((t) => t.groupId === g.id)
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.id)
    const scores: MatchScore[] = groupMatches
      .filter((m) => m.groupId === g.id && m.homeTeamId && m.awayTeamId)
      .map((m) => {
        const p = getPrediction(m.id)
        return {
          homeTeamId: m.homeTeamId as string,
          awayTeamId: m.awayTeamId as string,
          homeScore: p.homeScore as number,
          awayScore: p.awayScore as number,
        }
      })
    const { standings } = resolveGroupTies(teamIds, scores)
    const third = standings[2] // 3rd row (unresolved ties share a rank; index is stable)
    if (third) thirds.push({ ...third, groupLetter: g.letter })
  }

  const { ranking, unresolvedGroups } = rankThirdPlacedTeams(thirds)
  const rows: ThirdPlaceRow[] = ranking.map((r, i) => ({
    position: i + 1,
    groupLetter: r.groupLetter,
    team: { name: nameById.get(r.teamId) ?? r.teamId, countryCode: '' },
    played: r.played,
    goalDifference: r.goalDifference,
    points: r.points,
  }))
  return { rows, tieCount: unresolvedGroups.length }
}
