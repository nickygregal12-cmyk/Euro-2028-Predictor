// Pure domain function: takes the teams and match scores of a single group
// and returns the fully tie-broken standings. No UI, no database access —
// data in, data out. Implements section 6 of docs/scoring-rules.md.
//
// Steps 1-6 of the rules are pure calculation and resolve silently here.
// Step 7 (the manual prompt) is NOT done by this function: when the app
// cannot separate teams automatically, the affected teams are returned in
// `unresolvedGroups` / flagged `tiedUnresolved` so a screen can prompt the
// user. This function itself never does anything UI-related.

import {
  calculateGroupTable,
  type MatchScore,
  type TeamStanding,
} from './calculateGroupTable'

export type ResolvedStanding = TeamStanding & {
  // 1-based finishing position in the group. Members of a block the app
  // could not separate share the lowest position of that block.
  rank: number
  // true when this team sits in a block that steps 1-6 could not resolve,
  // and which therefore needs the manual step-7 prompt.
  tiedUnresolved: boolean
}

export type ResolveGroupTiesResult = {
  // Standings ordered best-to-worst. Members of an unresolved block are kept
  // adjacent, but their order relative to each other is arbitrary.
  standings: ResolvedStanding[]
  // Blocks of teamIds that steps 1-6 could not separate. Empty when the whole
  // group resolved automatically. Each block is the input to the user-facing
  // manual ordering prompt (step 7).
  unresolvedGroups: string[][]
}

// A contiguous run of teams in the final ordering. Either a single settled
// team (resolved), a group settled in order (resolved), or a cluster the
// app could not separate (unresolved).
type Block = { teamIds: string[]; resolved: boolean }

// Lexicographic compare of two equal-length score vectors. Positive when a
// ranks higher than b (each component is "bigger is better").
function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

// Order teamIds best-first by `score`, then group equal-scoring teams into
// adjacent buckets. Sort is stable, so equal teams keep their input order,
// which keeps the whole function deterministic.
function bucketBy(
  teamIds: string[],
  score: (teamId: string) => number[]
): string[][] {
  const sorted = [...teamIds].sort((a, b) => compareScores(score(b), score(a)))
  const buckets: string[][] = []
  for (const id of sorted) {
    const last = buckets[buckets.length - 1]
    if (last && compareScores(score(last[0]), score(id)) === 0) {
      last.push(id)
    } else {
      buckets.push([id])
    }
  }
  return buckets
}

// Head-to-head standings among just `teamIds` — calculateGroupTable only
// counts matches whose both teams are in the passed set, so feeding it a
// subset yields exactly the mini-league between those teams.
function headToHead(
  teamIds: string[],
  matches: MatchScore[]
): Map<string, TeamStanding> {
  const table = calculateGroupTable(teamIds, matches)
  return new Map(table.map((s) => [s.teamId, s]))
}

// Resolve a set of teams already known to be level on overall points.
// Returns an ordered list of blocks, best-first.
function resolveCluster(
  teamIds: string[],
  matches: MatchScore[],
  fullStandings: Map<string, TeamStanding>
): Block[] {
  if (teamIds.length === 1) return [{ teamIds, resolved: true }]

  // Steps 1-3: head-to-head points, then goal difference, then goals scored,
  // among only the tied teams.
  const h2h = headToHead(teamIds, matches)
  const h2hBuckets = bucketBy(teamIds, (id) => {
    const s = h2h.get(id)!
    return [s.points, s.goalDifference, s.goalsFor]
  })

  if (h2hBuckets.length > 1) {
    // Head-to-head separated the set. Step 4: re-apply steps 1-3 to each
    // still-tied subset. Each subset is strictly smaller, so this recursion
    // terminates, and recomputing head-to-head on the subset alone is what
    // makes step 4 meaningful.
    const blocks: Block[] = []
    for (const bucket of h2hBuckets) {
      blocks.push(...resolveCluster(bucket, matches, fullStandings))
    }
    return blocks
  }

  // Steps 5-6: head-to-head gave nothing. Fall back to overall goal
  // difference, then overall goals scored, across all group games.
  const overallBuckets = bucketBy(teamIds, (id) => {
    const s = fullStandings.get(id)!
    return [s.goalDifference, s.goalsFor]
  })

  if (overallBuckets.length > 1) {
    const blocks: Block[] = []
    for (const bucket of overallBuckets) {
      // A bucket still >1 here is level on points, head-to-head, overall goal
      // difference and overall goals. Overall stats are per-team and don't
      // change on a subset, so nothing more can separate them → step 7.
      blocks.push({ teamIds: bucket, resolved: bucket.length === 1 })
    }
    return blocks
  }

  // Step 7: nothing separated them. Leave the whole cluster for the manual
  // prompt.
  return [{ teamIds, resolved: false }]
}

/**
 * Fully orders a group's standings, applying the section-6 tie-break rules
 * (steps 1-6). Teams that cannot be separated automatically are returned
 * adjacent, flagged `tiedUnresolved`, and listed in `unresolvedGroups` for
 * the manual step-7 prompt.
 *
 * `teamIds` should include every team in the group; `matches` are the group's
 * match scores (partial groups are fine).
 */
export function resolveGroupTies(
  teamIds: string[],
  matches: MatchScore[]
): ResolveGroupTiesResult {
  const fullTable = calculateGroupTable(teamIds, matches)
  const fullStandings = new Map(fullTable.map((s) => [s.teamId, s]))

  // Teams are only ever tied when level on overall points; everything else is
  // a tie-break within a point bucket.
  const pointBuckets = bucketBy(
    fullTable.map((s) => s.teamId),
    (id) => [fullStandings.get(id)!.points]
  )

  const ordered: Block[] = []
  for (const bucket of pointBuckets) {
    ordered.push(...resolveCluster(bucket, matches, fullStandings))
  }

  const standings: ResolvedStanding[] = []
  const unresolvedGroups: string[][] = []
  let position = 1
  for (const block of ordered) {
    const unresolved = !block.resolved && block.teamIds.length > 1
    if (unresolved) unresolvedGroups.push([...block.teamIds])

    const rank = position
    for (const id of block.teamIds) {
      standings.push({
        ...fullStandings.get(id)!,
        rank,
        tiedUnresolved: unresolved,
      })
      position += 1
    }
  }

  return { standings, unresolvedGroups }
}
