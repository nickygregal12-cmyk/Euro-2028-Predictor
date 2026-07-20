import { describe, it, expect } from 'vitest'
import { resolveGroupTies } from '../../src/domain/tournament/resolveGroupTies'
import type { MatchScore } from '../../src/domain/tournament/calculateGroupTable'
import { calculateScore } from '../../src/domain/tournament/calculateScore'
import { sumGroupGoals } from '../../src/domain/tournament/groupGoals'

// Reference scenarios for the scoring-engine completion (§2/§3/§4 in
// 20260721120000_scoring_positions_knockout_awards.sql). The SQL derives the
// same actuals (final group order via the §6 tie-breaks, actual knockout stage,
// derived group-goals total) and must produce these exact points — this file is
// the checked-in target for cross-checking the DB recompute by hand.

describe('§2 group positions — actual order derived via tie-breaks, then scored', () => {
  // A group with TWO 2-way point ties, each broken cleanly by head-to-head:
  //   A & B level on 6 → A above B (A beat B 1–0)
  //   C & D level on 3 → C above D (C beat D 1–0)
  // Hand-computed actual order: [A, B, C, D].
  const teamIds = ['A', 'B', 'C', 'D']
  const matches: MatchScore[] = [
    { homeTeamId: 'A', awayTeamId: 'B', homeScore: 1, awayScore: 0 }, // A beats B (H2H)
    { homeTeamId: 'A', awayTeamId: 'C', homeScore: 1, awayScore: 0 },
    { homeTeamId: 'D', awayTeamId: 'A', homeScore: 1, awayScore: 0 },
    { homeTeamId: 'B', awayTeamId: 'C', homeScore: 1, awayScore: 0 },
    { homeTeamId: 'B', awayTeamId: 'D', homeScore: 1, awayScore: 0 },
    { homeTeamId: 'C', awayTeamId: 'D', homeScore: 1, awayScore: 0 }, // C beats D (H2H)
  ]

  const actualOrder = resolveGroupTies(teamIds, matches).standings.map((s) => s.teamId)

  it('resolves the two head-to-head ties to [A, B, C, D]', () => {
    expect(actualOrder).toEqual(['A', 'B', 'C', 'D'])
  })

  const scorePositions = (predictedOrder: string[]) =>
    calculateScore(
      { groupOrders: [{ groupId: 'G', order: predictedOrder }] },
      { groupOrders: [{ groupId: 'G', order: actualOrder }] },
    ).groupOrders.total

  it('awards the full 13 (4×2 + 5 bonus) for a perfect order', () => {
    expect(scorePositions(['A', 'B', 'C', 'D'])).toBe(13)
  })

  it('awards 2 per correct position, no bonus, when only some are right', () => {
    // A,B right; C,D swapped → 2 correct → 4 points, no full-order bonus.
    expect(scorePositions(['A', 'B', 'D', 'C'])).toBe(4)
  })

  it('awards 0 when nothing is in the right place', () => {
    expect(scorePositions(['D', 'C', 'B', 'A'])).toBe(0)
  })
})

describe('§3 knockout — stacking per team, exits at various rounds', () => {
  // Predicted furthest stage per team vs the stage each ACTUALLY reached.
  const predicted = [
    { teamId: 'champ', stage: 'CHAMPION' as const }, // actual CHAMPION
    { teamId: 'flop', stage: 'CHAMPION' as const }, // actual only R16
    { teamId: 'surprise', stage: 'R16' as const }, // actual FINAL (went further)
    { teamId: 'shortfall', stage: 'SF' as const }, // actual QF (fell short)
    { teamId: 'missed', stage: 'QF' as const }, // never reached KO (no actual)
  ]
  const actuals = [
    { teamId: 'champ', stage: 'CHAMPION' as const },
    { teamId: 'flop', stage: 'R16' as const },
    { teamId: 'surprise', stage: 'FINAL' as const },
    { teamId: 'shortfall', stage: 'QF' as const },
    // 'missed' absent → not in the knockouts.
  ]

  const breakdown = calculateScore({ knockout: predicted }, { knockout: actuals })
  const pointsOf = (teamId: string) =>
    breakdown.knockout.items.find((i) => i.teamId === teamId)?.points ?? 0

  it('champion all the way stacks to 110 (10+15+20+25+40)', () => {
    expect(pointsOf('champ')).toBe(110)
  })

  it('scores only the stage reached when the team fell well short (champion→R16 = 10)', () => {
    expect(pointsOf('flop')).toBe(10)
  })

  it('caps at the predicted stage when the team went further (R16 pick, reached final = 10)', () => {
    expect(pointsOf('surprise')).toBe(10)
  })

  it('stacks up to the reached stage on a shortfall (SF pick, reached QF = 10+15 = 25)', () => {
    expect(pointsOf('shortfall')).toBe(25)
  })

  it('scores nothing for a team that never reached the knockouts', () => {
    expect(breakdown.knockout.items.some((i) => i.teamId === 'missed')).toBe(false)
    expect(pointsOf('missed')).toBe(0)
  })

  it('sums the knockout section correctly', () => {
    expect(breakdown.knockout.total).toBe(110 + 10 + 10 + 25)
  })
})

describe('§4 awards — group-goals total is DERIVED from the 36 scores, then tiered', () => {
  // 36 predicted group scores; the total-goals prediction is their sum, never a
  // separately stored field (scoring-rules §4). Build a known total: 35 matches
  // of 1–1 (2 goals each = 70) + one 2–3 (5) = 75.
  const scores = [
    ...Array.from({ length: 35 }, () => ({ homeScore: 1, awayScore: 1 })),
    { homeScore: 2, awayScore: 3 },
  ]

  it('derives the predicted total as the sum of all 36 predicted scores', () => {
    const summary = sumGroupGoals(scores)
    expect(summary.total).toBe(75)
    expect(summary.predictedCount).toBe(36)
  })

  const scoreGoals = (predicted: number, actual: number) =>
    calculateScore(
      { bonus: { totalGoals: predicted } },
      { bonus: { totalGoals: actual } },
    ).bonus.totalGoals

  it('bands the derived total: exact 40, ≤5 30, ≤10 20, outside 0 (tiered, not stacked)', () => {
    const derived = sumGroupGoals(scores).total // 75
    expect(scoreGoals(derived, 75).points).toBe(40) // exact
    expect(scoreGoals(derived, 70).points).toBe(30) // diff 5  → within5
    expect(scoreGoals(derived, 80).points).toBe(30) // diff 5  → within5
    expect(scoreGoals(derived, 65).points).toBe(20) // diff 10 → within10
    expect(scoreGoals(derived, 64).points).toBe(0) // diff 11 → outside
  })

  it('does not score total goals until the actual is known', () => {
    // Mirrors the SQL gate: no §4 total-goals event until the group stage is complete.
    expect(
      calculateScore({ bonus: { totalGoals: 75 } }, {}).bonus.totalGoals.points,
    ).toBe(0)
  })

  it('awards 25 for the correct golden boot and 0 otherwise', () => {
    expect(
      calculateScore({ bonus: { goldenBootPlayerId: 'p1' } }, { bonus: { goldenBootPlayerId: 'p1' } })
        .bonus.goldenBoot.points,
    ).toBe(25)
    expect(
      calculateScore({ bonus: { goldenBootPlayerId: 'p1' } }, { bonus: { goldenBootPlayerId: 'p2' } })
        .bonus.goldenBoot.points,
    ).toBe(0)
  })
})
