/**
 * Predictor Cup season format selector.
 *
 * Authority: ADR 0014 as amended by ADR 0020 (interface name Predictor
 * Championship; internal identifiers unchanged). The creator chooses nothing
 * about structure — field size and the remaining round count select it:
 *
 * - a field of two or three is declined; head-to-head is offered instead —
 *   a two-player league is not a cup;
 * - four to twenty entrants form ONE group when the remaining rounds still
 *   allow home and away: `meetings = floor(remaining / (N − 1))`, and twenty
 *   is the cap precisely because it is the last size at which a single group
 *   still plays two meetings in a 38-round season;
 * - odd meetings → the split balances the odd meeting: halves (the larger
 *   half first when the field is odd) each play a post-split round-robin,
 *   and points carry through — the split follows the arithmetic, never the
 *   host league;
 * - even meetings → the remainder of the calendar is the seeded playoff and
 *   knockout window; an exact fit (N = 20 over 38) has no tail at all;
 * - a Cup need not fill the season — leftover rounds are reported, never
 *   padded away;
 * - above the cap, or mid-season when two meetings no longer fit a single
 *   group, the field is drawn into BALANCED groups of at most twenty —
 *   thirty entrants is two groups of fifteen, never a twenty and a ten.
 *
 * The selector decides shape only. Draw, schedule generation, qualification,
 * seeding and the knockout bracket remain with their existing authorities,
 * and jokers never apply to Cup scoring anywhere downstream of this. Pure
 * domain: no storage, network or ambient clock.
 */

export const CUP_GROUP_CAP = 20
export const CUP_MINIMUM_FIELD = 4
/** A single group (or every group) must still play home and away. */
export const CUP_MINIMUM_MEETINGS = 2

export type CupSingleGroupTail =
  | {
      kind: 'split'
      /** The larger half first when the field is odd — seven and six. */
      topHalfSize: number
      bottomHalfSize: number
      /** Post-split round-robin rounds, sized by the larger half. */
      splitRounds: number
    }
  | { kind: 'seeded_playoff_window'; rounds: number }
  | { kind: 'none' }

export type CupFormatDecision =
  | { kind: 'declined_head_to_head' }
  | {
      kind: 'single_group'
      meetings: number
      leagueRounds: number
      tail: CupSingleGroupTail
      /** Calendar the competition leaves unused. Real competitions finish early. */
      leftoverRounds: number
    }
  | {
      kind: 'groups'
      groupCount: number
      /** Balanced sizes, largest first; smaller groups take byes. */
      groupSizes: readonly number[]
    }
  | { kind: 'refused'; reason: 'invalid_input' | 'insufficient_rounds' }

/** Rounds a k-entrant single round-robin occupies: k − 1 when k is even, k when odd (byes). */
function roundRobinRounds(entrants: number): number {
  return entrants % 2 === 0 ? entrants - 1 : entrants
}

function balancedGroups(fieldSize: number, groupCount: number): number[] {
  const base = Math.floor(fieldSize / groupCount)
  const larger = fieldSize % groupCount
  return Array.from({ length: groupCount }, (_, index) => (index < larger ? base + 1 : base))
}

function singleGroup(fieldSize: number, remainingRounds: number, meetings: number): CupFormatDecision {
  const leagueRounds = meetings * (fieldSize - 1)

  if (meetings % 2 === 1) {
    const topHalfSize = Math.ceil(fieldSize / 2)
    const bottomHalfSize = Math.floor(fieldSize / 2)
    const splitRounds = roundRobinRounds(topHalfSize)
    if (leagueRounds + splitRounds <= remainingRounds) {
      return {
        kind: 'single_group',
        meetings,
        leagueRounds,
        tail: { kind: 'split', topHalfSize, bottomHalfSize, splitRounds },
        leftoverRounds: remainingRounds - leagueRounds - splitRounds,
      }
    }
    // The odd meeting count fits but its balancing split does not: play one
    // meeting fewer, which is even and needs no split.
    return singleGroup(fieldSize, remainingRounds, meetings - 1)
  }

  const window = remainingRounds - leagueRounds
  return {
    kind: 'single_group',
    meetings,
    leagueRounds,
    tail: window > 0 ? { kind: 'seeded_playoff_window', rounds: window } : { kind: 'none' },
    leftoverRounds: 0,
  }
}

/**
 * Select the Cup format. Deterministic: the same field and calendar always
 * produce the same shape, so the published fixture list can be reproduced
 * from the audited draw.
 */
export function selectCupFormat(fieldSize: number, remainingRounds: number): CupFormatDecision {
  if (
    !Number.isInteger(fieldSize) ||
    !Number.isInteger(remainingRounds) ||
    fieldSize < 2 ||
    remainingRounds < 1
  ) {
    return { kind: 'refused', reason: 'invalid_input' }
  }

  if (fieldSize < CUP_MINIMUM_FIELD) return { kind: 'declined_head_to_head' }

  const meetings = Math.floor(remainingRounds / (fieldSize - 1))
  if (fieldSize <= CUP_GROUP_CAP && meetings >= CUP_MINIMUM_MEETINGS) {
    return singleGroup(fieldSize, remainingRounds, meetings)
  }

  // Groups: the cap bounds every group, and mid-season the calendar bounds
  // it further — each group must still fit two meetings in what remains.
  const largestViableGroup = Math.min(
    CUP_GROUP_CAP,
    Math.floor(remainingRounds / CUP_MINIMUM_MEETINGS) + 1,
  )
  if (largestViableGroup < CUP_MINIMUM_FIELD) {
    return { kind: 'refused', reason: 'insufficient_rounds' }
  }
  const groupCount = Math.ceil(fieldSize / largestViableGroup)
  const groupSizes = balancedGroups(fieldSize, groupCount)
  if (groupSizes[groupSizes.length - 1] < CUP_MINIMUM_FIELD) {
    return { kind: 'refused', reason: 'insufficient_rounds' }
  }
  return { kind: 'groups', groupCount, groupSizes }
}
