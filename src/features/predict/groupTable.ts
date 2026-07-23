// Builds the live GroupTable rows for one group from the user's predictions,
// via the domain layer (resolveGroupTies). Pure data-in/data-out; keeps the
// screen free of standings logic (CLAUDE.md architecture rule 2).

import { resolveGroupTies } from '../../domain/tournament/resolveGroupTies'
import type { MatchScore } from '../../domain/tournament/calculateGroupTable'
import type { TieResolution } from '../../domain/tournament/tieResolutions'
import type { Match, Team } from '../../services/supabase/tournamentData'
import type { GroupTableRow } from '../../design-system'
import type { Prediction } from '../../app/providers/PredictionsProvider'

export function buildGroupTableRows(
  groupTeams: Team[],
  groupMatches: Match[],
  getPrediction: (matchId: string) => Prediction,
  resolutions: TieResolution[] = [],
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

  const { standings } = resolveGroupTies(teamIds, scores, resolutions)
  // Sequential display positions 1..4. Once the user confirms a manual order,
  // the table reflects it immediately; an unresolved block remains adjacent but
  // its internal display order is not treated as a sporting criterion.
  return standings.map((standing, index) => ({
    position: index + 1,
    team: {
      name: nameById.get(standing.teamId) ?? standing.teamId,
      countryCode: '',
    },
    played: standing.played,
    goalDifference: standing.goalDifference,
    points: standing.points,
  }))
}
