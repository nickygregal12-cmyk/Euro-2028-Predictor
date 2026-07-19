// Builds the live GroupTable rows for one group from the user's predictions,
// via the domain layer (resolveGroupTies). Pure data-in/data-out; keeps the
// screen free of standings logic (CLAUDE.md architecture rule 2).

import { resolveGroupTies } from '../../domain/tournament/resolveGroupTies'
import type { MatchScore } from '../../domain/tournament/calculateGroupTable'
import type { Match, Team } from '../../services/supabase/tournamentData'
import type { GroupTableRow } from '../../design-system'
import type { Prediction } from '../../app/providers/PredictionsProvider'

export function buildGroupTableRows(
  groupTeams: Team[],
  groupMatches: Match[],
  getPrediction: (matchId: string) => Prediction,
): GroupTableRow[] {
  const teams = [...groupTeams].sort((a, b) => a.slot - b.slot)
  const teamIds = teams.map((t) => t.id)
  const nameById = new Map(teams.map((t) => [t.id, t.name]))

  const scores: MatchScore[] = []
  for (const m of groupMatches) {
    if (!m.homeTeamId || !m.awayTeamId) continue
    const p = getPrediction(m.id)
    if (p.homeScore === null || p.awayScore === null) continue
    scores.push({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
    })
  }

  const { standings } = resolveGroupTies(teamIds, scores)
  // Sequential display positions 1..4 (unresolved ties share a rank, which we
  // don't use as a key). Placeholder teams have no flag yet, so countryCode is
  // empty until the real qualified teams are seeded.
  return standings.map((s, i) => ({
    position: i + 1,
    team: { name: nameById.get(s.teamId) ?? s.teamId, countryCode: '' },
    played: s.played,
    goalDifference: s.goalDifference,
    points: s.points,
  }))
}
