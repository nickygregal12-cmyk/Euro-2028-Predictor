// Pure domain helpers for the Profile page (design-system §6). Data in, data
// out — the stat grid's derived numbers and the reveal-gating rule, testable in
// isolation. No React, no DB.

export type OutcomeKind = 'exact' | 'correct' | 'wrong'

export type ProfileStats = {
  exactScores: number
  correctResults: number
  // Resulted group matches the user actually predicted (the denominator).
  scoredMatches: number
  // Share of scored matches whose outcome was right (exact OR correct result),
  // rounded to a whole percent. Null when nothing has been scored yet — the UI
  // shows a dash rather than "0%", which would read as "all wrong".
  accuracyPercent: number | null
}

/**
 * Derive the profile stat grid's counts from the per-match outcome kinds of the
 * user's resulted group predictions. Accuracy counts exact + correct as "right".
 */
export function profileStats(kinds: OutcomeKind[]): ProfileStats {
  const exactScores = kinds.filter((k) => k === 'exact').length
  const correctResults = kinds.filter((k) => k === 'correct').length
  const scoredMatches = kinds.length
  const accuracyPercent =
    scoredMatches === 0
      ? null
      : Math.round(((exactScores + correctResults) / scoredMatches) * 100)
  return { exactScores, correctResults, scoredMatches, accuracyPercent }
}

export type ProfileVisibility = 'full' | 'hidden'

/**
 * The reveal rule (competition-structure §6.3): a user always sees their own
 * profile in full; another player's stats/predictions are hidden until entries
 * lock, then revealed. Server-side enforcement (RLS / a co-membership,
 * post-lock security-definer read) is what actually protects other users' data —
 * this mirror is for the UI and must never be the sole gate.
 */
export function profileVisibility(input: { isOwn: boolean; locked: boolean }): ProfileVisibility {
  if (input.isOwn) return 'full'
  return input.locked ? 'full' : 'hidden'
}
