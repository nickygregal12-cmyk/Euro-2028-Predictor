// Scoring config (NOT logic). Every point value and threshold is transcribed
// verbatim from docs/scoring-rules.md sections 1-4. calculateScore() reads
// these; no scoring number is ever a literal inside the logic. If the doc
// changes, change it here (and only here).

// --- Section 1: group match points ---
export const GROUP_MATCH_POINTS = {
  exactScore: 5, // exact score (total — does not stack with correctResult)
  correctResult: 3, // right win/draw/loss outcome, wrong score
  wrong: 0,
}

// A joker doubles ALL match points for the match it is placed on (group stage
// only): exact 5→10, correct 3→6, wrong 0→0. Jokers affect group match points
// only — never group position, knockout, or bonus points. The placement limits
// (max 5 jokers per entry, one per match) and the kickoff-commitment lock are
// enforcement concerns handled server-side, not in scoring.
export const JOKER_MULTIPLIER = 2

// Each entry has exactly five jokers (scoring-rules §1). This is the allowance,
// not scoring — but it's a rule value, so it lives here rather than as a literal
// in logic. The max-5 limit and the kickoff-commitment lock are enforced
// server-side; jokerPolicy.ts mirrors them for the UI (never the sole guard).
export const JOKER_ALLOWANCE = 5

// --- Section 2: predicted group position points ---
export const GROUP_POSITION_POINTS = {
  perCorrectTeam: 2, // per team in the correct position
  fullOrderBonus: 5, // all four teams in the right order
}

// --- Section 3: knockout progression points (stack per team) ---
export type KnockoutStage = 'R16' | 'QF' | 'SF' | 'FINAL' | 'CHAMPION'

// Ordered least-to-furthest; reaching a stage implies reaching every earlier one.
export const KNOCKOUT_STAGE_ORDER: KnockoutStage[] = [
  'R16',
  'QF',
  'SF',
  'FINAL',
  'CHAMPION',
]

export const KNOCKOUT_STAGE_POINTS: Record<KnockoutStage, number> = {
  R16: 10,
  QF: 15,
  SF: 20,
  FINAL: 25,
  CHAMPION: 40,
}

// --- Section 4: bonus predictions ---
export const GOLDEN_BOOT_POINTS = 25

export type TotalGoalsBand = 'exact' | 'within5' | 'within10' | 'outside' | 'none'

// Tiered, NOT stacked: a prediction lands in exactly the first band whose
// maxDiff it satisfies (bands ordered best-first). Anything past the last band
// scores 0 ('outside').
export const TOTAL_GOALS_BANDS: {
  band: Exclude<TotalGoalsBand, 'outside' | 'none'>
  maxDiff: number
  points: number
}[] = [
  { band: 'exact', maxDiff: 0, points: 40 },
  { band: 'within5', maxDiff: 5, points: 30 },
  { band: 'within10', maxDiff: 10, points: 20 },
]

export const TOTAL_GOALS_OUTSIDE_POINTS = 0
