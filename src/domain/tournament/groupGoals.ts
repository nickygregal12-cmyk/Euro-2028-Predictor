// Pure derivation of the group-stage total-goals bonus prediction (scoring §4).
// This number is NEVER entered or stored: it is always the running sum of goals
// across the user's predicted group-match scores, so the prediction and the
// scores can never contradict each other. Data in, data out.

export type PredictedScore = { homeScore: number | null; awayScore: number | null }

export type GroupGoalsSummary = {
  total: number // goals summed across matches predicted so far
  predictedCount: number // group matches with a complete prediction
  matchCount: number // total group matches
}

/**
 * Sums home+away goals over every fully-predicted group match. A match with
 * either score missing contributes nothing and isn't counted as predicted.
 */
export function sumGroupGoals(scores: PredictedScore[]): GroupGoalsSummary {
  let total = 0
  let predictedCount = 0
  for (const s of scores) {
    if (s.homeScore === null || s.awayScore === null) continue
    total += s.homeScore + s.awayScore
    predictedCount += 1
  }
  return { total, predictedCount, matchCount: scores.length }
}
