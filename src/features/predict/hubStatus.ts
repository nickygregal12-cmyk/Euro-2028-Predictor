// Derives the Predict-hub stage statuses from the tournament data + the user's
// predictions, via the domain layer. Presentational components render these;
// they don't compute them (CLAUDE.md architecture rule 2).

import { resolveGroupTies } from '../../domain/tournament/resolveGroupTies'
import type { MatchScore } from '../../domain/tournament/calculateGroupTable'
import type { TournamentData } from '../../services/supabase/tournamentData'
import type { Prediction } from '../../app/providers/PredictionsProvider'

const BRACKET_TOTAL = 15 // R16 (8) + QF (4) + SF (2) + Final (1)
const JOKERS_TOTAL = 5

export type HubStatus = {
  groups: { predicted: number; total: number; complete: boolean }
  // 'blocked' = groups not yet all predicted; then 'ties' or 'settled'.
  thirdPlace: { state: 'blocked' | 'ties' | 'settled'; tieCount: number }
  bracket: { picked: number; total: number }
  jokers: { placed: number; total: number }
  reviewUnlocked: boolean
  overallPercent: number
}

export function computeHubStatus(
  data: TournamentData,
  getPrediction: (matchId: string) => Prediction,
  jokerCount: number,
): HubStatus {
  const groupMatches = data.matches.filter((m) => m.round === 'group')
  const total = groupMatches.length
  let predicted = 0
  for (const m of groupMatches) {
    const p = getPrediction(m.id)
    if (p.homeScore !== null && p.awayScore !== null) predicted += 1
  }
  const groupsComplete = total > 0 && predicted === total

  let tieCount = 0
  let state: HubStatus['thirdPlace']['state'] = 'blocked'
  if (groupsComplete) {
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
      tieCount += resolveGroupTies(teamIds, scores).unresolvedGroups.length
    }
    state = tieCount > 0 ? 'ties' : 'settled'
  }

  // Bracket winner-picks live in predicted_progression, which the v0.1 skeleton
  // doesn't wire yet — so this reads 0 and keeps Review honestly locked.
  const bracketPicked: number = 0
  const reviewUnlocked = groupsComplete && state === 'settled' && bracketPicked === BRACKET_TOTAL

  return {
    groups: { predicted, total, complete: groupsComplete },
    thirdPlace: { state, tieCount },
    bracket: { picked: bracketPicked, total: BRACKET_TOTAL },
    jokers: { placed: jokerCount, total: JOKERS_TOTAL },
    reviewUnlocked,
    overallPercent: total > 0 ? Math.round((predicted / total) * 100) : 0,
  }
}
