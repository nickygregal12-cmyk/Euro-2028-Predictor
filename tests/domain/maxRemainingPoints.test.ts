import { describe, it, expect } from 'vitest'
import { maxRemainingPoints } from '../../src/domain/tournament/maxRemainingPoints'
import {
  GROUP_MATCH_POINTS,
  JOKER_MULTIPLIER,
  GROUP_POSITION_POINTS,
  KNOCKOUT_STAGE_POINTS,
  GOLDEN_BOOT_POINTS,
  TOTAL_GOALS_BANDS,
} from '../../src/domain/tournament/scoringConfig'

const EXACT = GROUP_MATCH_POINTS.exactScore // 5
const ORDER_MAX =
  4 * GROUP_POSITION_POINTS.perCorrectTeam + GROUP_POSITION_POINTS.fullOrderBonus // 13
const GOALS_MAX = Math.max(...TOTAL_GOALS_BANDS.map((b) => b.points)) // 40

describe('maxRemainingPoints', () => {
  it('is zero for an entirely empty input', () => {
    expect(maxRemainingPoints({})).toEqual({
      total: 0,
      groupMatches: 0,
      groupOrders: 0,
      knockout: 0,
      bonus: 0,
    })
  })

  it('counts an unplayed match at the exact-score ceiling, a played one at zero', () => {
    const r = maxRemainingPoints({
      groupMatches: [
        { matchId: 'm1', resulted: false },
        { matchId: 'm2', resulted: true },
      ],
    })
    expect(r.groupMatches).toBe(EXACT)
    expect(r.total).toBe(EXACT)
  })

  it('doubles an unplayed jokered match', () => {
    const r = maxRemainingPoints({
      groupMatches: [{ matchId: 'm1', resulted: false, joker: true }],
    })
    expect(r.groupMatches).toBe(EXACT * JOKER_MULTIPLIER)
  })

  it('a joker on an already-played match adds nothing', () => {
    const r = maxRemainingPoints({
      groupMatches: [{ matchId: 'm1', resulted: true, joker: true }],
    })
    expect(r.groupMatches).toBe(0)
  })

  it('counts an undecided group order at the perfect-order ceiling', () => {
    const r = maxRemainingPoints({
      groupOrders: [
        { groupId: 'A', decided: false },
        { groupId: 'B', decided: true },
      ],
    })
    expect(r.groupOrders).toBe(ORDER_MAX)
  })

  it('an undecided champion pick can still earn every knockout stage', () => {
    const r = maxRemainingPoints({
      knockout: [{ teamId: 't', predictedStage: 'CHAMPION', status: { kind: 'undecided' } }],
    })
    const full =
      KNOCKOUT_STAGE_POINTS.R16 +
      KNOCKOUT_STAGE_POINTS.QF +
      KNOCKOUT_STAGE_POINTS.SF +
      KNOCKOUT_STAGE_POINTS.FINAL +
      KNOCKOUT_STAGE_POINTS.CHAMPION
    expect(r.knockout).toBe(full)
  })

  it('an alive team only has the stages beyond its confirmed one remaining', () => {
    // Predicted CHAMPION, confirmed to have reached QF and still in: only SF,
    // FINAL, CHAMPION remain (R16 + QF are already banked, not "remaining").
    const r = maxRemainingPoints({
      knockout: [
        { teamId: 't', predictedStage: 'CHAMPION', status: { kind: 'alive', reached: 'QF' } },
      ],
    })
    expect(r.knockout).toBe(
      KNOCKOUT_STAGE_POINTS.SF + KNOCKOUT_STAGE_POINTS.FINAL + KNOCKOUT_STAGE_POINTS.CHAMPION,
    )
  })

  it('an alive team already at/above its predicted stage has nothing left', () => {
    const r = maxRemainingPoints({
      knockout: [{ teamId: 't', predictedStage: 'QF', status: { kind: 'alive', reached: 'SF' } }],
    })
    expect(r.knockout).toBe(0)
  })

  it('an eliminated team can earn no further knockout points', () => {
    const r = maxRemainingPoints({
      knockout: [
        { teamId: 't', predictedStage: 'CHAMPION', status: { kind: 'eliminated', reached: 'R16' } },
      ],
    })
    expect(r.knockout).toBe(0)
  })

  it('scores bonus ceilings only while undecided', () => {
    expect(
      maxRemainingPoints({ bonus: { goldenBootDecided: false, totalGoalsDecided: false } }).bonus,
    ).toBe(GOLDEN_BOOT_POINTS + GOALS_MAX)
    expect(
      maxRemainingPoints({ bonus: { goldenBootDecided: true, totalGoalsDecided: true } }).bonus,
    ).toBe(0)
    expect(
      maxRemainingPoints({ bonus: { goldenBootDecided: true, totalGoalsDecided: false } }).bonus,
    ).toBe(GOALS_MAX)
  })

  it('sums categories into the total', () => {
    const r = maxRemainingPoints({
      groupMatches: [{ matchId: 'm', resulted: false }],
      groupOrders: [{ groupId: 'A', decided: false }],
      knockout: [{ teamId: 't', predictedStage: 'R16', status: { kind: 'undecided' } }],
      bonus: { goldenBootDecided: false, totalGoalsDecided: true },
    })
    expect(r.total).toBe(
      r.groupMatches + r.groupOrders + r.knockout + r.bonus,
    )
    expect(r.total).toBe(EXACT + ORDER_MAX + KNOCKOUT_STAGE_POINTS.R16 + GOLDEN_BOOT_POINTS)
  })
})
