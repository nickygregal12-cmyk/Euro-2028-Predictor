import type { CombinedFixtureRow } from './combinedFixturesModel'

/**
 * "Since you were last here" — the football in the player's competitions that
 * finished while they were away.
 *
 * WHAT IT CLAIMS, AND WHAT IT DELIBERATELY DOES NOT. It says which matches
 * finished. It does NOT say what the player scored, how their rank moved, who
 * overtook them, or whether their Last Man Standing pick survived — every one
 * of which the direction lists, and every one of which needs a read that does
 * not exist yet (`MIG-UI-01`, `MIG-UI-03`). Rather than approximate them in the
 * browser, this surface shows the true half and says nothing about the rest.
 * A retention feature that guesses at a player's points is worse than one that
 * covers less ground.
 *
 * IT IS NOT AN ACTIVITY FEED. Only settled results, only in competitions the
 * player plays in, only since the marker, and capped — the question is "what
 * changed that I care about", not "what happened".
 *
 * A RESULT IS SETTLED BECAUSE THE SERVER SAYS SO. `played` comes from the
 * status the server settled, never from a clock comparison, so a postponed or
 * abandoned match cannot appear here as a finished one. The kickoff is used
 * only to decide whether it happened after the marker, which is a question
 * about ordering rather than about whether it counts.
 *
 * PURE.
 */

export type SinceLastVisit = {
  /** Results that finished since the marker, most recent first. */
  results: readonly CombinedFixtureRow[]
  /** How many more there were beyond the cap. */
  more: number
  /**
   * False on a first visit, when there is no marker to measure from. The
   * caller renders nothing rather than a summary of the whole season dressed
   * as "what changed".
   */
  available: boolean
}

const DEFAULT_LIMIT = 4

export function presentSinceLastVisit(
  rows: readonly CombinedFixtureRow[],
  lastVisit: string | null,
  limit: number = DEFAULT_LIMIT,
): SinceLastVisit {
  if (!lastVisit) return { results: [], more: 0, available: false }
  const since = new Date(lastVisit).getTime()
  if (Number.isNaN(since)) return { results: [], more: 0, available: false }

  const finished = rows
    .filter((row) => row.played)
    .map((row) => ({ row, at: row.kickoffAt ? new Date(row.kickoffAt).getTime() : NaN }))
    .filter((entry) => !Number.isNaN(entry.at) && entry.at >= since)
    .sort((left, right) => right.at - left.at)

  return {
    results: finished.slice(0, limit).map((entry) => entry.row),
    more: Math.max(0, finished.length - limit),
    available: true,
  }
}
