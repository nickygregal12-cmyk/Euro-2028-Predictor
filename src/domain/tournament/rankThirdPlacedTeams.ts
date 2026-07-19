// Pure domain function: ranks the six third-placed teams and picks the four
// that advance to the Round of 16. No UI, no database access — data in, data
// out. Implements section 6 of docs/tournament-structure.md.
//
// Criteria 1-4 (points, goal difference, goals scored, wins) are pure
// calculation and resolve silently here. If teams are still level after
// criterion 4, this function does NOT decide the order: the tied teams are
// returned flagged `tiedUnresolved` and listed in `unresolvedGroups` (with the
// positions they contest) for a screen to prompt on. Same pattern as
// resolveGroupTies — this function never does anything UI-related.

import type { TeamStanding } from './calculateGroupTable'
import { resolvedOrderFor, type TieResolution } from './tieResolutions'

// A third-placed team carries its group letter so the R16 allocation can key
// on the SET of qualifying groups (see resolveRoundOf16).
export type ThirdPlacedTeam = TeamStanding & { groupLetter: string }

export type RankedThird = ThirdPlacedTeam & {
  // 1-based finishing position among the thirds. Members of a block the app
  // could not separate share the lowest position of that block.
  rank: number
  // true when this team sits in a block that criteria 1-4 could not resolve.
  tiedUnresolved: boolean
}

export type UnresolvedThirdTie = {
  teamIds: string[]
  // 1-based sequential positions this tied block occupies (e.g. [4, 5] means
  // the tie straddles the qualification boundary).
  positions: number[]
}

export type RankThirdPlacedResult = {
  // All six thirds ordered best-to-worst.
  ranking: RankedThird[]
  // The four qualifying thirds, or null when an unresolved tie straddles the
  // 4th/5th boundary so the qualifying SET itself cannot be determined yet.
  // (Order among tied teams never matters to the R16 allocation, which keys on
  // the set of qualifying groups — only a boundary-straddling tie blocks it.)
  qualifiers: RankedThird[] | null
  // Ties criteria 1-4 could not break, for the manual resolution prompt.
  unresolvedGroups: UnresolvedThirdTie[]
}

// Lexicographic compare of two equal-length score vectors. Positive when a
// ranks higher than b (each component is "bigger is better").
function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

// Section 6 criteria in order: points, goal difference, goals scored, wins.
function rankingScore(t: ThirdPlacedTeam): number[] {
  return [t.points, t.goalDifference, t.goalsFor, t.won]
}

/**
 * Ranks all six third-placed teams and identifies the four that advance.
 * `teams` should contain exactly the six third-placed teams (one per group).
 * `resolutions` are the user's manual orderings for blocks criteria 1-4 could
 * not separate — pure input, never read from storage. A block the user has
 * resolved is ordered as they chose and no longer reported as unresolved, which
 * is also what lets a boundary-straddling tie yield a definite qualifying set.
 */
export function rankThirdPlacedTeams(
  teams: ThirdPlacedTeam[],
  resolutions: TieResolution[] = []
): RankThirdPlacedResult {
  // Stable sort best-first, so teams that are fully level keep their input
  // order and the whole function stays deterministic.
  const sorted = [...teams].sort((a, b) =>
    compareScores(rankingScore(b), rankingScore(a))
  )

  // Group teams that are level on all four criteria into adjacent blocks.
  const rawBlocks: ThirdPlacedTeam[][] = []
  for (const t of sorted) {
    const last = rawBlocks[rawBlocks.length - 1]
    if (last && compareScores(rankingScore(last[0]), rankingScore(t)) === 0) {
      last.push(t)
    } else {
      rawBlocks.push([t])
    }
  }

  // Apply any manual resolution: a resolved block is expanded into single-team
  // blocks in the user's chosen order, so each takes its own distinct rank.
  const blocks: { teams: ThirdPlacedTeam[]; unresolved: boolean }[] = []
  for (const block of rawBlocks) {
    if (block.length > 1) {
      const order = resolvedOrderFor(resolutions, block.map((t) => t.teamId))
      if (order) {
        const byId = new Map(block.map((t) => [t.teamId, t]))
        for (const id of order) blocks.push({ teams: [byId.get(id)!], unresolved: false })
        continue
      }
    }
    blocks.push({ teams: block, unresolved: block.length > 1 })
  }

  const ranking: RankedThird[] = []
  const unresolvedGroups: UnresolvedThirdTie[] = []
  let position = 1
  for (const block of blocks) {
    const topPosition = position
    const positions: number[] = []
    for (const t of block.teams) {
      ranking.push({ ...t, rank: topPosition, tiedUnresolved: block.unresolved })
      positions.push(position)
      position += 1
    }
    if (block.unresolved) {
      unresolvedGroups.push({ teamIds: block.teams.map((t) => t.teamId), positions })
    }
  }

  return { ranking, qualifiers: qualifiersOrNull(ranking), unresolvedGroups }
}

// The four qualifiers are simply the top four — unless an unresolved tie
// straddles the 4th/5th boundary, in which case which teams make up the top
// four is genuinely undetermined and we return null for the UI to resolve.
function qualifiersOrNull(ranking: RankedThird[]): RankedThird[] | null {
  if (ranking.length < 4) return null
  const fourth = ranking[3]
  const fifth = ranking[4]
  const straddles =
    fifth !== undefined &&
    fourth.tiedUnresolved &&
    fifth.tiedUnresolved &&
    fourth.rank === fifth.rank
  return straddles ? null : ranking.slice(0, 4)
}
