import type { SeasonLeagueStandingsRow } from '../../services/supabase/seasonLeagueStandingsModel'

/**
 * Rival Watch — the player against one person they chose (contract 157,
 * `MIG-UI-09`).
 *
 * WHO IS ELIGIBLE IS THE SERVER'S BOUNDARY, NOT THIS FILE'S. `set_pinned_rival`
 * refuses anybody the caller does not share a private league with — contract
 * 151's disclosure boundary, reused rather than re-decided, because a pin that
 * worked on a stranger would be user discovery by another name. The candidates
 * here therefore come from a league table the caller is already looking at, so
 * every name offered is one the server will accept and one the player can
 * already see.
 *
 * IT COMPARES, IT DOES NOT SCORE. Points and rank are the league read's, banked
 * by the season authorities. The only arithmetic is a subtraction of two numbers
 * that are both already on screen, which is the same thing the player would do
 * by looking — and it is why this needs no server read of its own.
 *
 * A PINNED RIVAL WHO IS NOT IN THIS TABLE IS NOT AN ERROR. Pins are stored per
 * competition and a player can share more than one league in a season; a rival
 * pinned from another league simply does not appear in this one's comparison.
 * Nothing is deleted on that account.
 *
 * RANK IS THE LEAGUE'S RANK, and the copy that consumes it must say so. It is
 * recomputed inside the league by the server because a private league is its own
 * table (contract 128); calling it "your season rank" would be a different
 * number.
 *
 * PURE. Rows and pinned ids in, presentation out; no clock, no network.
 */

export type RivalComparison = {
  userId: string
  displayName: string
  /** Positive when the caller is ahead. */
  pointsDifference: number
  /** Positive when the caller is ranked higher (a smaller rank number). */
  rankDifference: number
  yourPoints: number
  theirPoints: number
  yourRank: number
  theirRank: number
  matchweeksPlayed: number
  /** True when the rival has played fewer matchweeks than the caller. */
  hasGamesInHand: boolean
}

export type RivalWatch = {
  /** The comparisons that could be made from this table, pin order preserved. */
  pinned: readonly RivalComparison[]
  /** Everybody else in the table who could be pinned. Never the caller. */
  candidates: readonly { userId: string; displayName: string }[]
  /**
   * True when the caller has no row in this table — they are a league member
   * who has not entered the game. There is nothing to compare, and saying so
   * beats printing a comparison against zero.
   */
  youAreNotPlaying: boolean
}

export function presentRivalWatch(
  rows: readonly SeasonLeagueStandingsRow[],
  pinnedUserIds: readonly string[],
): RivalWatch {
  const you = rows.find((row) => row.isYou) ?? null
  const others = rows.filter((row) => !row.isYou)

  if (!you) {
    return {
      pinned: [],
      candidates: others.map((row) => ({ userId: row.userId, displayName: row.displayName })),
      youAreNotPlaying: true,
    }
  }

  const byId = new Map(others.map((row) => [row.userId, row]))
  const pinned: RivalComparison[] = []
  for (const userId of pinnedUserIds) {
    const rival = byId.get(userId)
    // Pinned from another league in the same season, or no longer a member.
    // Skipped here and untouched on the server.
    if (!rival) continue
    pinned.push({
      userId: rival.userId,
      displayName: rival.displayName,
      pointsDifference: you.points - rival.points,
      // Positive means the caller is ranked higher, which is the SMALLER rank
      // number. Subtracting the other way round would print an arrow pointing
      // at the wrong player.
      rankDifference: rival.rank - you.rank,
      yourPoints: you.points,
      theirPoints: rival.points,
      yourRank: you.rank,
      theirRank: rival.rank,
      matchweeksPlayed: rival.matchweeksPlayed,
      hasGamesInHand: rival.matchweeksPlayed < you.matchweeksPlayed,
    })
  }

  return {
    pinned,
    candidates: others
      .filter((row) => !pinnedUserIds.includes(row.userId))
      .map((row) => ({ userId: row.userId, displayName: row.displayName })),
    youAreNotPlaying: false,
  }
}

/**
 * How a points difference reads in a sentence.
 *
 * Level is its own case rather than "0 ahead", because a dead heat is the one
 * state a player wants named.
 */
export function pointsSentence(comparison: RivalComparison): string {
  const gap = Math.abs(comparison.pointsDifference)
  if (gap === 0) return 'Level on points'
  const point = gap === 1 ? 'point' : 'points'
  return comparison.pointsDifference > 0
    ? `${gap} ${point} ahead`
    : `${gap} ${point} behind`
}
