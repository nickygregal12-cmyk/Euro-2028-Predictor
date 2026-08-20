import type { CombinedFixtureRow } from './combinedFixturesModel'

/**
 * "Since you were last here" — the football in the player's competitions that
 * finished while they were away.
 *
 * WHAT IT CLAIMS, AND WHAT IT DELIBERATELY DOES NOT. It says which matches
 * finished, and nothing else. What those results DID to the player — points,
 * rank, exact scores, league movement — is the Matchweek Recap's answer, from
 * contracts 151 and 150, and it is a separate section built from separate
 * reads. This model must not grow either: one derives from the football, the
 * other from the player's own banked totals, and merging them would put a
 * points claim inside a list of results that has no points in it.
 *
 * A Last Man Standing survival verdict is still absent: it comes from the
 * settlement authority per competition and has no cross-competition read.
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

/**
 * The selection itself, over anything with a settled flag and an instant.
 *
 * ============================ WHY IT IS GENERIC ==========================
 *
 * The Hub reads combined fixture rows and vNext Home reads its own `Match`, and
 * both need exactly this answer: what finished since the marker, newest first,
 * capped, and NOTHING at all on a first visit. Written twice it would be two
 * rules that agree until one of them is edited — most likely the cap, or the
 * first-visit case, which is the one that matters and the one a second author
 * is most likely to "fix".
 *
 * The type parameter is deliberately not a shared row type. Making both callers
 * share a row shape would couple the Hub's fixture list to vNext's presentation
 * model, which is a far larger coupling than a predicate and an accessor.
 */
export function selectSinceLastVisit<T>(
  items: readonly T[],
  read: { settled: (item: T) => boolean; at: (item: T) => string | null },
  lastVisit: string | null,
  limit: number = DEFAULT_LIMIT,
): { results: readonly T[]; more: number; available: boolean } {
  if (!lastVisit) return { results: [], more: 0, available: false }
  const since = new Date(lastVisit).getTime()
  if (Number.isNaN(since)) return { results: [], more: 0, available: false }

  const finished = items
    .filter((item) => read.settled(item))
    .map((item) => {
      const at = read.at(item)
      return { item, at: at ? new Date(at).getTime() : NaN }
    })
    .filter((entry) => !Number.isNaN(entry.at) && entry.at >= since)
    .sort((left, right) => right.at - left.at)

  return {
    results: finished.slice(0, limit).map((entry) => entry.item),
    more: Math.max(0, finished.length - limit),
    available: true,
  }
}

export function presentSinceLastVisit(
  rows: readonly CombinedFixtureRow[],
  lastVisit: string | null,
  limit: number = DEFAULT_LIMIT,
): SinceLastVisit {
  return selectSinceLastVisit(
    rows,
    { settled: (row) => row.played, at: (row) => row.kickoffAt },
    lastVisit,
    limit,
  )
}
