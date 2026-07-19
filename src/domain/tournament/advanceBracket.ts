// Pure domain function: takes the knockout winners chosen so far and produces
// the fixtures that are now playable but not yet decided. No UI, no database
// access — data in, data out. Operates purely on slot references
// (R16-1 … R16-8 → QF-1 … QF-4 → SF-1, SF-2 → Final) per sections 4-5 of
// euro2028-tournament-structure.md; the feed-through lives in knockoutBracket.ts.
//
// Winner-only mode: a "winner" is just the teamId that advances. R16 fixtures
// come from resolveRoundOf16; this function carries winners forward from there.

import {
  KNOCKOUT_BRACKET,
  type KnockoutRound,
} from './knockoutBracket'

// One side of a produced fixture: the team, plus which match it advanced from.
export type KnockoutFixtureSide = {
  fromRef: string // ref of the match this team won to get here
  teamId: string
}

export type KnockoutFixture = {
  ref: string
  round: KnockoutRound
  home: KnockoutFixtureSide
  away: KnockoutFixtureSide
}

/**
 * Given `winners` (a map of decided match ref → winning teamId, e.g. all eight
 * R16 winners), returns the next fixtures whose both feeders are now decided
 * and which are not themselves already decided. Call it again with each round's
 * winners added to walk the bracket forward:
 *
 *   R16 winners      → the four quarter-finals
 *   + QF winners     → the two semi-finals
 *   + SF winners     → the final
 *   + the final      → [] (tournament complete; champion = winners['FINAL'])
 *
 * Deterministic and order-preserving (bracket definition order).
 */
export function advanceBracket(
  winners: Record<string, string>
): KnockoutFixture[] {
  const fixtures: KnockoutFixture[] = []

  for (const match of KNOCKOUT_BRACKET) {
    // Skip matches already decided — they belong to an earlier call's round.
    if (winners[match.ref] !== undefined) continue

    const homeTeam = winners[match.homeFrom]
    const awayTeam = winners[match.awayFrom]
    // Both feeders must be settled before this fixture exists.
    if (homeTeam === undefined || awayTeam === undefined) continue

    fixtures.push({
      ref: match.ref,
      round: match.round,
      home: { fromRef: match.homeFrom, teamId: homeTeam },
      away: { fromRef: match.awayFrom, teamId: awayTeam },
    })
  }

  return fixtures
}
