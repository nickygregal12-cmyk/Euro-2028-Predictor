// Tournament-structure config (NOT logic). Transcribed verbatim from
// euro2028-tournament-structure.md sections 4 and 7. resolveRoundOf16() reads
// these tables; it does not compute placements any other way. If UEFA's final
// Euro 2028 regulations differ, update this file and the doc together.

export type GroupLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

// Which winner each third-placed team plays. Keys mirror the doc's slot key:
// WB = Winner B's opponent (R16-3), WC = Winner C (R16-4),
// WE = Winner E (R16-7), WF = Winner F (R16-5).
export type ThirdPlaceAllocation = {
  WB: GroupLetter
  WC: GroupLetter
  WE: GroupLetter
  WF: GroupLetter
}

// Section 7: the 15-combination allocation table. Keyed by the four qualifying
// group letters, sorted and joined (the SET of groups, not their ranking).
export const THIRD_PLACE_ALLOCATIONS: Record<string, ThirdPlaceAllocation> = {
  ABCD: { WB: 'A', WC: 'D', WE: 'B', WF: 'C' },
  ABCE: { WB: 'A', WC: 'E', WE: 'B', WF: 'C' },
  ABCF: { WB: 'A', WC: 'F', WE: 'B', WF: 'C' },
  ABDE: { WB: 'D', WC: 'E', WE: 'A', WF: 'B' },
  ABDF: { WB: 'D', WC: 'F', WE: 'A', WF: 'B' },
  ABEF: { WB: 'E', WC: 'F', WE: 'B', WF: 'A' },
  ACDE: { WB: 'E', WC: 'D', WE: 'C', WF: 'A' },
  ACDF: { WB: 'F', WC: 'D', WE: 'C', WF: 'A' },
  ACEF: { WB: 'E', WC: 'F', WE: 'C', WF: 'A' },
  ADEF: { WB: 'E', WC: 'F', WE: 'D', WF: 'A' },
  BCDE: { WB: 'E', WC: 'D', WE: 'B', WF: 'C' },
  BCDF: { WB: 'F', WC: 'D', WE: 'C', WF: 'B' },
  BCEF: { WB: 'F', WC: 'E', WE: 'C', WF: 'B' },
  BDEF: { WB: 'F', WC: 'E', WE: 'D', WF: 'B' },
  CDEF: { WB: 'F', WC: 'E', WE: 'D', WF: 'C' },
}

// A slot in the R16 fixture skeleton (section 4). `thirdVs` slots are filled
// from the allocation table above at resolve time; the rest are fixed.
export type SlotSpec =
  | { type: 'winner'; group: GroupLetter }
  | { type: 'runnerUp'; group: GroupLetter }
  | { type: 'thirdVs'; winnerSlot: keyof ThirdPlaceAllocation }

// Section 4: the eight R16 fixtures. Home team is listed first exactly as the
// doc lists them ("Winner A v Runner-up C", etc.).
export const ROUND_OF_16_SKELETON: {
  ref: string
  home: SlotSpec
  away: SlotSpec
}[] = [
  { ref: 'R16-1', home: { type: 'winner', group: 'A' }, away: { type: 'runnerUp', group: 'C' } },
  { ref: 'R16-2', home: { type: 'runnerUp', group: 'A' }, away: { type: 'runnerUp', group: 'B' } },
  { ref: 'R16-3', home: { type: 'winner', group: 'B' }, away: { type: 'thirdVs', winnerSlot: 'WB' } },
  { ref: 'R16-4', home: { type: 'winner', group: 'C' }, away: { type: 'thirdVs', winnerSlot: 'WC' } },
  { ref: 'R16-5', home: { type: 'winner', group: 'F' }, away: { type: 'thirdVs', winnerSlot: 'WF' } },
  { ref: 'R16-6', home: { type: 'runnerUp', group: 'D' }, away: { type: 'runnerUp', group: 'E' } },
  { ref: 'R16-7', home: { type: 'winner', group: 'E' }, away: { type: 'thirdVs', winnerSlot: 'WE' } },
  { ref: 'R16-8', home: { type: 'winner', group: 'D' }, away: { type: 'runnerUp', group: 'F' } },
]
