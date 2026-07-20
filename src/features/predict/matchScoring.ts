// Per-match scoring for the group predictor's scored card state. Invokes the
// domain scorer (calculateScore) so the card's points pill uses the exact same
// rules as the leaderboard's stored score_events — one source of truth. Keeps
// the scoring rule out of the component (CLAUDE.md rule 2).

import { calculateScore } from '../../domain/tournament/calculateScore'
import type { MatchCardScore } from '../../design-system'

/**
 * Score a single group match from the user's prediction against the real result.
 * Returns null when the user didn't predict this match (nothing to score) — the
 * card then shows the result with no points pill.
 */
export function scoreOneMatch(
  prediction: { homeScore: number | null; awayScore: number | null; joker?: boolean },
  result: { home: number; away: number },
): MatchCardScore | null {
  if (prediction.homeScore === null || prediction.awayScore === null) return null
  const breakdown = calculateScore(
    {
      groupMatches: [
        {
          matchId: 'm',
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
          joker: prediction.joker,
        },
      ],
    },
    { groupMatches: [{ matchId: 'm', homeScore: result.home, awayScore: result.away }] },
  )
  const item = breakdown.groupMatches.items[0]
  return { kind: item.kind, points: item.points, joker: item.joker }
}
