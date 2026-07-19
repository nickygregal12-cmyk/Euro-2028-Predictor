import { describe, it, expect } from 'vitest'
import {
  calculateScore,
  type ScorePrediction,
  type ScoreActuals,
} from '../../src/domain/tournament/calculateScore'

describe('calculateScore — section 1: group match points', () => {
  const predict = (homeScore: number, awayScore: number): ScorePrediction => ({
    groupMatches: [{ matchId: 'm1', homeScore, awayScore }],
  })
  const actual = (homeScore: number, awayScore: number): ScoreActuals => ({
    groupMatches: [{ matchId: 'm1', homeScore, awayScore }],
  })

  it('awards 5 for an exact score', () => {
    const r = calculateScore(predict(2, 1), actual(2, 1))
    expect(r.groupMatches.items[0]).toEqual({ matchId: 'm1', kind: 'exact', points: 5 })
    expect(r.total).toBe(5)
  })

  it('awards 3 for the correct result but wrong score (does not stack with 5)', () => {
    const r = calculateScore(predict(2, 1), actual(3, 0))
    expect(r.groupMatches.items[0]).toEqual({ matchId: 'm1', kind: 'correct', points: 3 })
    expect(r.total).toBe(3)
  })

  it('awards 3 for a correctly predicted draw with the wrong score', () => {
    const r = calculateScore(predict(1, 1), actual(2, 2))
    expect(r.groupMatches.items[0].kind).toBe('correct')
    expect(r.groupMatches.items[0].points).toBe(3)
  })

  it('awards 0 for the wrong result', () => {
    const r = calculateScore(predict(2, 1), actual(0, 1))
    expect(r.groupMatches.items[0]).toEqual({ matchId: 'm1', kind: 'wrong', points: 0 })
    expect(r.total).toBe(0)
  })

  it('does not score a match that has no result yet', () => {
    const r = calculateScore(predict(2, 1), { groupMatches: [] })
    expect(r.groupMatches.items).toEqual([])
    expect(r.total).toBe(0)
  })
})

describe('calculateScore — section 2: group position points', () => {
  const order = (o: string[]): ScorePrediction => ({
    groupOrders: [{ groupId: 'gA', order: o }],
  })
  const actualOrder = (o: string[]): ScoreActuals => ({
    groupOrders: [{ groupId: 'gA', order: o }],
  })

  it('awards 2 per correct team and a +5 bonus for the full order (max 13)', () => {
    const r = calculateScore(
      order(['a', 'b', 'c', 'd']),
      actualOrder(['a', 'b', 'c', 'd'])
    )
    expect(r.groupOrders.items[0]).toEqual({
      groupId: 'gA',
      correctPositions: 4,
      fullOrderBonus: true,
      points: 13,
    })
  })

  it('awards 2 per correct team with no bonus when the order is partly right', () => {
    // a and d correct; b/c swapped → 2 correct positions, no bonus.
    const r = calculateScore(
      order(['a', 'c', 'b', 'd']),
      actualOrder(['a', 'b', 'c', 'd'])
    )
    expect(r.groupOrders.items[0]).toEqual({
      groupId: 'gA',
      correctPositions: 2,
      fullOrderBonus: false,
      points: 4,
    })
  })

  it('awards 0 when no team is in the right position', () => {
    const r = calculateScore(
      order(['d', 'c', 'b', 'a']),
      actualOrder(['a', 'b', 'c', 'd'])
    )
    expect(r.groupOrders.items[0].correctPositions).toBe(0)
    expect(r.groupOrders.items[0].points).toBe(0)
  })
})

describe('calculateScore — section 3: knockout progression points', () => {
  const predictStage = (stage: any): ScorePrediction => ({
    knockout: [{ teamId: 'x', stage }],
  })
  const actualStage = (stage: any): ScoreActuals => ({
    knockout: [{ teamId: 'x', stage }],
  })

  it('stacks all five stages for a team correctly predicted as champion (110)', () => {
    const r = calculateScore(predictStage('CHAMPION'), actualStage('CHAMPION'))
    expect(r.knockout.items[0].correctStages).toEqual([
      'R16', 'QF', 'SF', 'FINAL', 'CHAMPION',
    ])
    expect(r.knockout.items[0].points).toBe(110)
  })

  it('scores only the stages actually reached when the team fell short of the prediction', () => {
    // Predicted champion, only reached the semi-final → 10 + 15 + 20 = 45.
    const r = calculateScore(predictStage('CHAMPION'), actualStage('SF'))
    expect(r.knockout.items[0].correctStages).toEqual(['R16', 'QF', 'SF'])
    expect(r.knockout.items[0].points).toBe(45)
  })

  it('scores only up to the predicted stage when the team went further', () => {
    // Predicted final, became champion → 10 + 15 + 20 + 25 = 70 (no champion pts).
    const r = calculateScore(predictStage('FINAL'), actualStage('CHAMPION'))
    expect(r.knockout.items[0].correctStages).toEqual(['R16', 'QF', 'SF', 'FINAL'])
    expect(r.knockout.items[0].points).toBe(70)
  })

  it('scores nothing for a team that never reached the knockouts', () => {
    // Predicted R16 but the team was eliminated in the group stage (no result).
    const r = calculateScore(predictStage('R16'), { knockout: [] })
    expect(r.knockout.items).toEqual([])
    expect(r.total).toBe(0)
  })
})

describe('calculateScore — section 4: bonus predictions', () => {
  it('awards 25 for the correct golden boot winner', () => {
    const r = calculateScore(
      { bonus: { goldenBootPlayerId: 'p9' } },
      { bonus: { goldenBootPlayerId: 'p9' } }
    )
    expect(r.bonus.goldenBoot).toEqual({ predicted: 'p9', correct: true, points: 25 })
    expect(r.total).toBe(25)
  })

  it('awards 0 for the wrong golden boot winner', () => {
    const r = calculateScore(
      { bonus: { goldenBootPlayerId: 'p9' } },
      { bonus: { goldenBootPlayerId: 'p7' } }
    )
    expect(r.bonus.goldenBoot.correct).toBe(false)
    expect(r.bonus.goldenBoot.points).toBe(0)
  })

  it('bands total-goals predictions (tiered, not stacked)', () => {
    const bands: [number, number, string, number][] = [
      // predicted, actual, expected band, expected points
      [140, 140, 'exact', 40],
      [136, 140, 'within5', 30], // diff 4
      [135, 140, 'within5', 30], // diff 5 (inclusive)
      [131, 140, 'within10', 20], // diff 9
      [130, 140, 'within10', 20], // diff 10 (inclusive)
      [129, 140, 'outside', 0], // diff 11
    ]
    for (const [predicted, actual, band, points] of bands) {
      const r = calculateScore(
        { bonus: { totalGoals: predicted } },
        { bonus: { totalGoals: actual } }
      )
      expect(r.bonus.totalGoals.band).toBe(band)
      expect(r.bonus.totalGoals.points).toBe(points)
    }
  })

  it('does not score total goals until the actual is known', () => {
    const r = calculateScore({ bonus: { totalGoals: 140 } }, { bonus: {} })
    expect(r.bonus.totalGoals.band).toBe('none')
    expect(r.bonus.totalGoals.points).toBe(0)
  })
})

describe('calculateScore — aggregate across all sections', () => {
  it('sums every section into the total with a full breakdown', () => {
    const prediction: ScorePrediction = {
      groupMatches: [
        { matchId: 'm1', homeScore: 2, awayScore: 1 }, // exact → 5
        { matchId: 'm2', homeScore: 1, awayScore: 0 }, // correct → 3
      ],
      groupOrders: [{ groupId: 'gA', order: ['a', 'b', 'c', 'd'] }], // full → 13
      knockout: [{ teamId: 'x', stage: 'CHAMPION' }], // 110
      bonus: { goldenBootPlayerId: 'p9', totalGoals: 140 }, // 25 + 40
    }
    const actuals: ScoreActuals = {
      groupMatches: [
        { matchId: 'm1', homeScore: 2, awayScore: 1 },
        { matchId: 'm2', homeScore: 3, awayScore: 2 },
      ],
      groupOrders: [{ groupId: 'gA', order: ['a', 'b', 'c', 'd'] }],
      knockout: [{ teamId: 'x', stage: 'CHAMPION' }],
      bonus: { goldenBootPlayerId: 'p9', totalGoals: 140 },
    }
    const r = calculateScore(prediction, actuals)

    expect(r.groupMatches.total).toBe(8)
    expect(r.groupOrders.total).toBe(13)
    expect(r.knockout.total).toBe(110)
    expect(r.bonus.total).toBe(65)
    expect(r.total).toBe(8 + 13 + 110 + 65) // 196
  })

  it('returns an all-zero breakdown for empty inputs', () => {
    const r = calculateScore({}, {})
    expect(r.total).toBe(0)
    expect(r.groupMatches.items).toEqual([])
    expect(r.bonus.total).toBe(0)
  })
})
