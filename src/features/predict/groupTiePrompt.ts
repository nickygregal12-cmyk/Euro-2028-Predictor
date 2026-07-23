import type { Prediction } from '../../app/providers/PredictionsProvider'
import type { MatchScore } from '../../domain/tournament/calculateGroupTable'
import { resolveGroupTies } from '../../domain/tournament/resolveGroupTies'
import {
  resolvedOrderFor,
  tieKey,
  type TieResolution,
} from '../../domain/tournament/tieResolutions'
import type { Match, Team } from '../../services/supabase/tournamentData'
import type { TieResolverTeam } from '../../design-system'

export type GroupTiePromptItem = {
  key: string
  title: string
  reason: string
  teams: TieResolverTeam[]
  resolved: boolean
}

export type GroupTiePrompt = {
  complete: boolean
  ties: GroupTiePromptItem[]
  pendingCount: number
}

const REASON =
  'These teams are still level after points, head-to-head results, goal difference and goals scored. ' +
  'In the real tournament, disciplinary records may decide the order. Because you are not predicting ' +
  'cards, keep the order shown, rearrange the teams, or change your group scores.'

export function buildGroupTiePrompt(
  letter: string,
  groupTeams: Team[],
  groupMatches: Match[],
  getPrediction: (matchId: string) => Prediction,
  resolutions: TieResolution[],
): GroupTiePrompt {
  const teams = [...groupTeams].sort((a, b) => a.slot - b.slot)
  const teamIds = teams.map((team) => team.id)
  const nameById = new Map(teams.map((team) => [team.id, team.name]))
  const scores: MatchScore[] = []

  for (const match of groupMatches) {
    if (!match.homeTeamId || !match.awayTeamId) continue
    const prediction = getPrediction(match.id)
    if (prediction.homeScore === null || prediction.awayScore === null) {
      return { complete: false, ties: [], pendingCount: 0 }
    }
    scores.push({
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
    })
  }

  const raw = resolveGroupTies(teamIds, scores)
  const ties = raw.unresolvedGroups.map((block) => {
    const stored = resolvedOrderFor(resolutions, block)
    const displayOrder = stored ?? block
    return {
      key: tieKey(block),
      title: `Group ${letter} needs your decision`,
      reason: REASON,
      teams: displayOrder.map((teamId) => ({
        id: teamId,
        name: nameById.get(teamId) ?? teamId,
        countryCode: '',
      })),
      resolved: stored !== undefined,
    }
  })

  return {
    complete: true,
    ties,
    pendingCount: ties.filter((tie) => !tie.resolved).length,
  }
}
