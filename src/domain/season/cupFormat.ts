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
 * - even meetings → no split; an exact fit (N = 20 over 38) has no tail at all;
 * - contract 198: whatever the calendar has left after the league RESERVES a
 *   knockout only when it can hold the whole bracket the qualifier count
 *   implies. A single group is a league and finishes as one — it is never
 *   shortened to make room, so a short remainder means no knockout, not a
 *   truncated one;
 * - a Cup need not fill the season — leftover rounds are reported, never
 *   padded away;
 * - above the cap, or mid-season when two meetings no longer fit a single
 *   group, the field is drawn into BALANCED groups of at most twenty —
 *   thirty entrants is two groups of fifteen, never a twenty and a ten. A
 *   multi-group field cannot be one league, so it ALWAYS ends in a knockout
 *   and contract 198 takes that calendar off the end BEFORE sizing the groups.
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
  | { kind: 'none' }

/**
 * Contract 198. The knockout a competition RESERVES calendar for, or null.
 *
 * `seeded_playoff_window` used to sit in the tail above and reported whatever
 * rounds happened to be left over, whether or not they could hold the bracket
 * the qualifier count implies. The reservation is a different claim and gets
 * its own field.
 */
export type CupKnockoutReservation = { rounds: number; qualifiers: number }

export type CupFormatDecision =
  | { kind: 'declined_head_to_head' }
  | {
      kind: 'single_group'
      meetings: number
      leagueRounds: number
      tail: CupSingleGroupTail
      /**
       * Contract 198. A single group is a LEAGUE and finishes as one. The
       * league is never shortened to make room, so a knockout appears only
       * when the rounds left after it can hold the whole bracket; otherwise
       * the table decides and this is null.
       */
      knockout: CupKnockoutReservation | null
      /** Calendar the competition leaves unused. Real competitions finish early. */
      leftoverRounds: number
    }
  | {
      kind: 'groups'
      groupCount: number
      /** Balanced sizes, largest first; smaller groups take byes. */
      groupSizes: readonly number[]
      /**
       * Contract 198. A multi-group field cannot be one league, so it ALWAYS
       * ends in a knockout and the calendar for it is reserved before the
       * groups are sized.
       */
      knockout: CupKnockoutReservation
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

/**
 * Qualifiers a group of this size sends on: section 6.1's two-thirds line,
 * rounded UP, in integer arithmetic so it cannot depend on rounding mode.
 * Mirrors `predictor_internal.cup_group_qualifying_limit`.
 */
export function cupQualifyingLimit(groupSize: number): number {
  const size = Math.max(0, groupSize)
  return Math.min(Math.max(1, Math.floor((2 * size + 2) / 3)), Math.max(1, size))
}

/**
 * Rounds a knockout bracket needs for a qualifier count: log2 of the largest
 * power of two at or below it, plus one preliminary playoff round when there is
 * a surplus. Mirrors `predictor_internal.cup_knockout_rounds`, which contract
 * 198 extracted from `admin_finalise_predictor_cup_groups` so the launcher that
 * RESERVES the calendar and the gate that CREATES the windows read one answer.
 */
export function cupKnockoutRounds(qualifiers: number): number {
  if (!Number.isInteger(qualifiers) || qualifiers < 2) return 0
  const power = 2 ** Math.floor(Math.log2(qualifiers))
  return Math.log2(power) + (qualifiers > power ? 1 : 0)
}

function singleGroup(fieldSize: number, remainingRounds: number, meetings: number): CupFormatDecision {
  const leagueRounds = meetings * (fieldSize - 1)
  let tail: CupSingleGroupTail = { kind: 'none' }
  let used = leagueRounds

  if (meetings % 2 === 1) {
    const topHalfSize = Math.ceil(fieldSize / 2)
    const bottomHalfSize = Math.floor(fieldSize / 2)
    const splitRounds = roundRobinRounds(topHalfSize)
    if (leagueRounds + splitRounds > remainingRounds) {
      // The odd meeting count fits but its balancing split does not: play one
      // meeting fewer, which is even and needs no split.
      return singleGroup(fieldSize, remainingRounds, meetings - 1)
    }
    tail = { kind: 'split', topHalfSize, bottomHalfSize, splitRounds }
    used = leagueRounds + splitRounds
  }

  // CONTRACT 198. The league is never shortened to make room. Whatever is left
  // after it becomes a knockout only if it can hold the whole bracket the
  // qualifier count implies; otherwise the table decides the competition and
  // the rounds are simply unused, which ADR 0014 already permits.
  const free = remainingRounds - used
  const qualifiers = cupQualifyingLimit(fieldSize)
  const knockoutRounds = cupKnockoutRounds(qualifiers)
  const reserves = knockoutRounds > 0 && free >= knockoutRounds

  return {
    kind: 'single_group',
    meetings,
    leagueRounds,
    tail,
    knockout: reserves ? { rounds: knockoutRounds, qualifiers } : null,
    leftoverRounds: reserves ? free - knockoutRounds : free,
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

  // CONTRACT 198. A multi-group field cannot be one league, so it MUST end in a
  // knockout, and the calendar for it is taken off the end BEFORE the groups
  // are sized. Reserving shrinks the groups, which changes how many qualify,
  // which changes the depth — so this settles to a fixed point rather than
  // reserving once. A field that will not settle is one the calendar genuinely
  // cannot hold, and is refused rather than approximated.
  let reserve = 0
  for (let pass = 0; pass < 8; pass += 1) {
    // The cap bounds every group, and the calendar bounds it further — each
    // group must still fit two meetings in what remains after the reservation.
    const largestViableGroup = Math.min(
      CUP_GROUP_CAP,
      Math.floor((remainingRounds - reserve) / CUP_MINIMUM_MEETINGS) + 1,
    )
    if (largestViableGroup < CUP_MINIMUM_FIELD) {
      return { kind: 'refused', reason: 'insufficient_rounds' }
    }
    const groupCount = Math.ceil(fieldSize / largestViableGroup)
    const groupSizes = balancedGroups(fieldSize, groupCount)
    const smallestGroupSize = groupSizes.at(-1)
    if (smallestGroupSize === undefined || smallestGroupSize < CUP_MINIMUM_FIELD) {
      return { kind: 'refused', reason: 'insufficient_rounds' }
    }

    const qualifiers = groupSizes.reduce((total, size) => total + cupQualifyingLimit(size), 0)
    const knockoutRounds = cupKnockoutRounds(qualifiers)
    if (knockoutRounds === reserve) {
      return { kind: 'groups', groupCount, groupSizes, knockout: { rounds: knockoutRounds, qualifiers } }
    }
    reserve = knockoutRounds
  }
  return { kind: 'refused', reason: 'insufficient_rounds' }
}
