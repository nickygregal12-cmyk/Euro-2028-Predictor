// The group-screen continuation CTA (design-system §6 "Continuous journey" — the
// deliberate minimal interim cut). Two pure pieces: whether a group is fully
// predicted, and the linear next step after it. Kept out of the component so the
// "group complete" predicate and the A–F → finalise ordering are unit-testable.

import type { Prediction } from '../../app/providers/PredictionsProvider'

type MatchLike = { id: string }

/** A group is complete once every one of its matches has both scores predicted. */
export function isGroupComplete(
  matches: MatchLike[],
  getPrediction: (matchId: string) => Prediction,
): boolean {
  return (
    matches.length > 0 &&
    matches.every((match) => {
      const prediction = getPrediction(match.id)
      return prediction.homeScore !== null && prediction.awayScore !== null
    })
  )
}

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export type Continuation = { label: string; path: string }

/**
 * The linear next step after completing a group: Groups A–E → the next letter;
 * Group F → Finalise Group Standings. Returns null for an unknown letter.
 */
export function groupContinuation(letter: string): Continuation | null {
  const index = GROUP_LETTERS.indexOf(
    letter.toUpperCase() as (typeof GROUP_LETTERS)[number],
  )
  if (index === -1) return null
  const next = GROUP_LETTERS[index + 1]
  if (next) {
    return {
      label: `Next: Group ${next} →`,
      path: `/predict/groups/${next}`,
    }
  }
  return {
    label: 'Next: Finalise Group Standings →',
    path: '/predict/third-place',
  }
}
