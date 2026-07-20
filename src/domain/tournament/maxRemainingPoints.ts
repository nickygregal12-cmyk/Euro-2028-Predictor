// Pure domain function: the maximum points an entry can STILL earn given the
// results known so far — the "hope metric" (design-system §6 league detail "Max
// left"; competition-structure §3/§6.4). Data in, data out: no UI, no database.
//
// It is an optimistic ceiling for this entry's already-fixed predictions: for
// anything not yet decided, assume the best possible outcome; for anything
// decided, nothing more can be earned from it (it is already scored). Adding
// this to calculateScore(...).total gives "max still possible".
//
// Point values come from scoringConfig.ts (never literals here), so it stays in
// lockstep with calculateScore.

import {
  GROUP_MATCH_POINTS,
  JOKER_MULTIPLIER,
  GROUP_POSITION_POINTS,
  KNOCKOUT_STAGE_ORDER,
  KNOCKOUT_STAGE_POINTS,
  GOLDEN_BOOT_POINTS,
  TOTAL_GOALS_BANDS,
  TOTAL_GOALS_OUTSIDE_POINTS,
  type KnockoutStage,
} from './scoringConfig'

// --- Inputs ---

// A predicted group match: once its real result is in, no further points are
// available from it. Before that, best case is an exact score (doubled by a
// joker), so that is the remaining ceiling.
export type MatchRemaining = {
  matchId: string
  resulted: boolean
  joker?: boolean
}

// A predicted group order: once the group's final table is settled, nothing more
// is available; before that the ceiling is a perfect order (4 correct + bonus).
export type GroupOrderRemaining = {
  groupId: string
  decided: boolean
}

// A predicted team's knockout status so far:
//   * 'undecided'  — fate unknown; it could still reach the predicted stage.
//   * 'alive'      — confirmed to have reached `reached` and still in; it can
//                    still progress up to the predicted stage.
//   * 'eliminated' — its run has ended; no further knockout points are possible.
// `reached` is the furthest stage confirmed so far (omit if none yet).
export type KnockoutStatus =
  | { kind: 'undecided' }
  | { kind: 'alive'; reached?: KnockoutStage }
  | { kind: 'eliminated'; reached?: KnockoutStage }

export type KnockoutRemaining = {
  teamId: string
  predictedStage: KnockoutStage
  status: KnockoutStatus
}

export type BonusRemaining = {
  goldenBootDecided: boolean
  totalGoalsDecided: boolean
}

export type MaxRemainingInput = {
  groupMatches?: MatchRemaining[]
  groupOrders?: GroupOrderRemaining[]
  knockout?: KnockoutRemaining[]
  bonus?: BonusRemaining
}

export type MaxRemaining = {
  total: number
  groupMatches: number
  groupOrders: number
  knockout: number
  bonus: number
}

// --- Helpers ---

const MATCH_CEILING = GROUP_MATCH_POINTS.exactScore
const GROUP_ORDER_CEILING =
  4 * GROUP_POSITION_POINTS.perCorrectTeam + GROUP_POSITION_POINTS.fullOrderBonus
const TOTAL_GOALS_CEILING = Math.max(
  TOTAL_GOALS_OUTSIDE_POINTS,
  ...TOTAL_GOALS_BANDS.map((b) => b.points),
)

// Points for stages strictly above `fromIdx` up to and including `toIdx`.
function sumStages(fromIdx: number, toIdx: number): number {
  let sum = 0
  for (let i = fromIdx + 1; i <= toIdx; i++) {
    sum += KNOCKOUT_STAGE_POINTS[KNOCKOUT_STAGE_ORDER[i]]
  }
  return sum
}

function knockoutRemaining(item: KnockoutRemaining): number {
  const predictedIdx = KNOCKOUT_STAGE_ORDER.indexOf(item.predictedStage)
  if (predictedIdx < 0) return 0

  switch (item.status.kind) {
    case 'undecided':
      // Every stage up to the predicted one is still theoretically reachable.
      return sumStages(-1, predictedIdx)
    case 'alive': {
      const reachedIdx = item.status.reached
        ? KNOCKOUT_STAGE_ORDER.indexOf(item.status.reached)
        : -1
      // Stages already confirmed are scored; the rest, up to predicted, remain.
      return sumStages(reachedIdx, predictedIdx)
    }
    case 'eliminated':
      // Out — nothing further can be earned.
      return 0
  }
}

/**
 * Maximum additional points still achievable for an entry, per scoring category
 * and in total. Absent categories contribute 0. The result is an upper bound —
 * the best the entry's fixed predictions could still do against unknown results.
 */
export function maxRemainingPoints(input: MaxRemainingInput): MaxRemaining {
  const groupMatches = (input.groupMatches ?? []).reduce(
    (sum, m) => sum + (m.resulted ? 0 : MATCH_CEILING * (m.joker ? JOKER_MULTIPLIER : 1)),
    0,
  )

  const groupOrders = (input.groupOrders ?? []).reduce(
    (sum, g) => sum + (g.decided ? 0 : GROUP_ORDER_CEILING),
    0,
  )

  const knockout = (input.knockout ?? []).reduce((sum, k) => sum + knockoutRemaining(k), 0)

  const bonus = input.bonus
    ? (input.bonus.goldenBootDecided ? 0 : GOLDEN_BOOT_POINTS) +
      (input.bonus.totalGoalsDecided ? 0 : TOTAL_GOALS_CEILING)
    : 0

  return {
    total: groupMatches + groupOrders + knockout + bonus,
    groupMatches,
    groupOrders,
    knockout,
    bonus,
  }
}
