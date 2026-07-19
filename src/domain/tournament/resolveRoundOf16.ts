// Pure domain function: maps group winners, runners-up and the four qualifying
// thirds into the eight Round of 16 fixtures by slot reference (R16-1 to
// R16-8). No UI, no database access — data in, data out. Implements sections 4
// and 7 of docs/tournament-structure.md.
//
// Third-place placement is a pure lookup into the section-7 allocation table
// (in roundOf16Allocation.ts), keyed by the SET of qualifying group letters.
// Placements are never computed any other way — the table is the only source.

import {
  ROUND_OF_16_SKELETON,
  THIRD_PLACE_ALLOCATIONS,
  type GroupLetter,
  type SlotSpec,
} from './roundOf16Allocation'

export type QualifyingThird = {
  groupLetter: GroupLetter
  teamId: string
}

export type RoundOf16Input = {
  // group letter → teamId of that group's winner / runner-up
  winners: Record<GroupLetter, string>
  runnersUp: Record<GroupLetter, string>
  // exactly the four thirds that advanced (from rankThirdPlacedTeams)
  qualifyingThirds: QualifyingThird[]
}

// Where a team in a fixture came from — slot reference only, never a hardcoded
// team; real teams resolve through slots.
export type R16Slot =
  | { type: 'winner'; group: GroupLetter }
  | { type: 'runnerUp'; group: GroupLetter }
  | { type: 'third'; group: GroupLetter }

export type R16FixtureSide = { slot: R16Slot; teamId: string }

export type R16Fixture = {
  ref: string // 'R16-1' … 'R16-8'
  home: R16FixtureSide
  away: R16FixtureSide
}

/**
 * Resolves the eight Round of 16 fixtures. `qualifyingThirds` must be exactly
 * the four advancing thirds; their group letters (as a set) select the
 * allocation row. Throws on an input that has no matching allocation row (wrong
 * count, duplicate group, etc.) — there is no sensible partial bracket.
 */
export function resolveRoundOf16(input: RoundOf16Input): R16Fixture[] {
  const { winners, runnersUp, qualifyingThirds } = input

  // Key the allocation table by the SET of qualifying group letters.
  const key = qualifyingThirds
    .map((t) => t.groupLetter)
    .sort()
    .join('')
  const allocation = THIRD_PLACE_ALLOCATIONS[key]
  if (!allocation) {
    throw new Error(
      `No R16 third-place allocation for qualifying groups "${key}" ` +
        `(expected exactly four distinct groups from A-F)`
    )
  }

  const thirdByGroup = new Map(
    qualifyingThirds.map((t) => [t.groupLetter, t.teamId])
  )

  const resolveSlot = (spec: SlotSpec): R16FixtureSide => {
    switch (spec.type) {
      case 'winner':
        return { slot: { type: 'winner', group: spec.group }, teamId: winners[spec.group] }
      case 'runnerUp':
        return { slot: { type: 'runnerUp', group: spec.group }, teamId: runnersUp[spec.group] }
      case 'thirdVs': {
        const group = allocation[spec.winnerSlot]
        const teamId = thirdByGroup.get(group)
        if (teamId === undefined) {
          // Allocation row and qualifying set disagree — should be impossible
          // for a valid input, so surface it rather than emit a broken slot.
          throw new Error(
            `Allocation expects a third from group ${group} but none qualified`
          )
        }
        return { slot: { type: 'third', group }, teamId }
      }
    }
  }

  return ROUND_OF_16_SKELETON.map((fixture) => ({
    ref: fixture.ref,
    home: resolveSlot(fixture.home),
    away: resolveSlot(fixture.away),
  }))
}
