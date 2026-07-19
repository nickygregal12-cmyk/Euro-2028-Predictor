// Pure domain function: takes a user's predictions and the actual results and
// returns the total points plus a full explanation breakdown. No UI, no
// database access — data in, data out. Implements sections 1-4 of
// euro2028-scoring-rules.md; all point values come from scoringConfig.ts.
//
// Jokers (section 1) double a single group match's points and nothing else;
// their placement/lock rules are enforced server-side, so scoring simply
// honours the per-match joker flag it is handed.
//
// Deterministic and recalculable: the same predictions and results always
// produce the same output, and the whole score is derived from source data in
// one pass, so recalculation can never double-count.
//
// Partial results are fine (tournament in progress): a prediction with no
// corresponding result yet is simply not scored — never penalised.

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
  type TotalGoalsBand,
} from './scoringConfig'

// --- Inputs ---

export type MatchScorePrediction = {
  matchId: string
  homeScore: number
  awayScore: number
  // A joker doubles this match's points (group stage only). Optional; absent =
  // no joker. Whether the joker is validly placed/committed is enforced
  // server-side — scoring just honours the flag it is given.
  joker?: boolean
}
export type MatchScoreResult = {
  matchId: string
  homeScore: number
  awayScore: number
}

export type GroupOrderPrediction = {
  groupId: string
  order: string[] // teamIds, predicted 1st → 4th
}
export type GroupOrderResult = GroupOrderPrediction

export type TeamStagePrediction = {
  teamId: string
  stage: KnockoutStage // furthest stage the user predicts this team reaches
}
export type TeamStageResult = {
  teamId: string
  stage: KnockoutStage // furthest stage the team actually reached (only teams that reached R16+)
}

export type BonusPrediction = {
  goldenBootPlayerId?: string
  totalGoals?: number
}
export type BonusResult = BonusPrediction

export type ScorePrediction = {
  groupMatches?: MatchScorePrediction[]
  groupOrders?: GroupOrderPrediction[]
  knockout?: TeamStagePrediction[]
  bonus?: BonusPrediction
}
export type ScoreActuals = {
  groupMatches?: MatchScoreResult[]
  groupOrders?: GroupOrderResult[]
  knockout?: TeamStageResult[]
  bonus?: BonusResult
}

// --- Breakdown (the "explanation") ---

export type GroupMatchScore = {
  matchId: string
  kind: 'exact' | 'correct' | 'wrong'
  joker: boolean // whether a joker doubled this match's points
  points: number
}
export type GroupOrderScore = {
  groupId: string
  correctPositions: number
  fullOrderBonus: boolean
  points: number
}
export type KnockoutScore = {
  teamId: string
  correctStages: KnockoutStage[]
  points: number
}
export type BonusScore = {
  goldenBoot: { predicted?: string; correct: boolean; points: number }
  totalGoals: {
    predicted?: number
    actual?: number
    diff?: number
    band: TotalGoalsBand
    points: number
  }
  total: number
}

export type ScoreBreakdown = {
  total: number
  groupMatches: { total: number; items: GroupMatchScore[] }
  groupOrders: { total: number; items: GroupOrderScore[] }
  knockout: { total: number; items: KnockoutScore[] }
  bonus: BonusScore
}

// --- Section 1: group match ---

function outcome(homeScore: number, awayScore: number): 'H' | 'D' | 'A' {
  if (homeScore > awayScore) return 'H'
  if (homeScore < awayScore) return 'A'
  return 'D'
}

function scoreGroupMatch(
  prediction: MatchScorePrediction,
  result: MatchScoreResult
): GroupMatchScore {
  let kind: GroupMatchScore['kind']
  let base: number
  if (
    prediction.homeScore === result.homeScore &&
    prediction.awayScore === result.awayScore
  ) {
    kind = 'exact'
    base = GROUP_MATCH_POINTS.exactScore
  } else if (
    outcome(prediction.homeScore, prediction.awayScore) ===
    outcome(result.homeScore, result.awayScore)
  ) {
    kind = 'correct'
    base = GROUP_MATCH_POINTS.correctResult
  } else {
    kind = 'wrong'
    base = GROUP_MATCH_POINTS.wrong
  }

  // A joker doubles the match points (and only the match points).
  const joker = prediction.joker === true
  const points = joker ? base * JOKER_MULTIPLIER : base
  return { matchId: prediction.matchId, kind, joker, points }
}

// --- Section 2: group order ---

function scoreGroupOrder(
  prediction: GroupOrderPrediction,
  result: GroupOrderResult
): GroupOrderScore {
  const compareLength = Math.min(prediction.order.length, result.order.length)
  let correctPositions = 0
  for (let i = 0; i < compareLength; i++) {
    if (prediction.order[i] === result.order[i]) correctPositions += 1
  }
  // Full-order bonus only when every actual position was predicted correctly.
  const fullOrderBonus =
    result.order.length > 0 && correctPositions === result.order.length
  const points =
    correctPositions * GROUP_POSITION_POINTS.perCorrectTeam +
    (fullOrderBonus ? GROUP_POSITION_POINTS.fullOrderBonus : 0)
  return { groupId: prediction.groupId, correctPositions, fullOrderBonus, points }
}

// --- Section 3: knockout progression ---

function scoreProgression(
  teamId: string,
  predictedStage: KnockoutStage,
  actualStage: KnockoutStage | undefined
): KnockoutScore {
  const predictedIdx = KNOCKOUT_STAGE_ORDER.indexOf(predictedStage)
  const actualIdx =
    actualStage === undefined ? -1 : KNOCKOUT_STAGE_ORDER.indexOf(actualStage)
  // Points stack for every stage the team both was predicted to reach and did
  // reach — i.e. up to the lesser of the two.
  const correctUpto = Math.min(predictedIdx, actualIdx)
  const correctStages =
    correctUpto >= 0 ? KNOCKOUT_STAGE_ORDER.slice(0, correctUpto + 1) : []
  const points = correctStages.reduce((sum, s) => sum + KNOCKOUT_STAGE_POINTS[s], 0)
  return { teamId, correctStages, points }
}

// --- Section 4: bonus ---

function bandFor(diff: number): { band: TotalGoalsBand; points: number } {
  for (const b of TOTAL_GOALS_BANDS) {
    if (diff <= b.maxDiff) return { band: b.band, points: b.points }
  }
  return { band: 'outside', points: TOTAL_GOALS_OUTSIDE_POINTS }
}

function scoreBonus(prediction: BonusPrediction, result: BonusResult): BonusScore {
  const gbCorrect =
    prediction.goldenBootPlayerId !== undefined &&
    prediction.goldenBootPlayerId === result.goldenBootPlayerId
  const goldenBoot = {
    predicted: prediction.goldenBootPlayerId,
    correct: gbCorrect,
    points: gbCorrect ? GOLDEN_BOOT_POINTS : 0,
  }

  let totalGoals: BonusScore['totalGoals']
  if (prediction.totalGoals === undefined || result.totalGoals === undefined) {
    totalGoals = {
      predicted: prediction.totalGoals,
      actual: result.totalGoals,
      band: 'none',
      points: 0,
    }
  } else {
    const diff = Math.abs(prediction.totalGoals - result.totalGoals)
    const { band, points } = bandFor(diff)
    totalGoals = {
      predicted: prediction.totalGoals,
      actual: result.totalGoals,
      diff,
      band,
      points,
    }
  }

  return { goldenBoot, totalGoals, total: goldenBoot.points + totalGoals.points }
}

/**
 * Scores a full prediction against the actual results. Every section is scored
 * independently and summed; the returned breakdown explains each contribution.
 */
export function calculateScore(
  prediction: ScorePrediction,
  actuals: ScoreActuals
): ScoreBreakdown {
  // Section 1 — score only matches that have a result.
  const resultByMatch = new Map(
    (actuals.groupMatches ?? []).map((m) => [m.matchId, m])
  )
  const groupMatchItems: GroupMatchScore[] = []
  for (const p of prediction.groupMatches ?? []) {
    const result = resultByMatch.get(p.matchId)
    if (result) groupMatchItems.push(scoreGroupMatch(p, result))
  }

  // Section 2 — score only groups whose final order is known.
  const orderByGroup = new Map(
    (actuals.groupOrders ?? []).map((g) => [g.groupId, g])
  )
  const groupOrderItems: GroupOrderScore[] = []
  for (const p of prediction.groupOrders ?? []) {
    const result = orderByGroup.get(p.groupId)
    if (result) groupOrderItems.push(scoreGroupOrder(p, result))
  }

  // Section 3 — score only teams whose knockout fate is known.
  const stageByTeam = new Map(
    (actuals.knockout ?? []).map((t) => [t.teamId, t.stage])
  )
  const knockoutItems: KnockoutScore[] = []
  for (const p of prediction.knockout ?? []) {
    if (!stageByTeam.has(p.teamId)) continue
    knockoutItems.push(scoreProgression(p.teamId, p.stage, stageByTeam.get(p.teamId)))
  }

  // Section 4 — bonuses.
  const bonus = scoreBonus(prediction.bonus ?? {}, actuals.bonus ?? {})

  const sum = (items: { points: number }[]) =>
    items.reduce((s, i) => s + i.points, 0)
  const groupMatchesTotal = sum(groupMatchItems)
  const groupOrdersTotal = sum(groupOrderItems)
  const knockoutTotal = sum(knockoutItems)

  return {
    total: groupMatchesTotal + groupOrdersTotal + knockoutTotal + bonus.total,
    groupMatches: { total: groupMatchesTotal, items: groupMatchItems },
    groupOrders: { total: groupOrdersTotal, items: groupOrderItems },
    knockout: { total: knockoutTotal, items: knockoutItems },
    bonus,
  }
}
