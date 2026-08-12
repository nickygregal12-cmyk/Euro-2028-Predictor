import { describe, expect, it } from 'vitest'
import { presentSideHonours } from '../../../src/features/season/sideHonoursModel'
import type { SeasonLeagueMatchweekPredictions } from '../../../src/services/supabase/seasonLeaguePredictionsModel'
import type { SeasonLeagueMovement } from '../../../src/services/supabase/seasonLeagueMovementModel'

/**
 * `INNOV-012`. The properties that matter: nothing is awarded from an unsettled
 * matchweek, ties are shared rather than broken, and every award carries the
 * rule that produced it.
 */

function pageOf(
  overrides: Partial<SeasonLeagueMatchweekPredictions> = {},
): SeasonLeagueMatchweekPredictions {
  return {
    league: { id: 'lg-1', name: 'The Office' },
    matchweek: { id: 'mw-5', ordinal: 5, label: 'Matchweek 5', locksAt: null },
    revealed: true,
    serverNow: null,
    fixtures: [
      { id: 'fx-1', kickoffAt: null, status: 'played', home: 'A', away: 'B', result: { home: 2, away: 1 } },
      { id: 'fx-2', kickoffAt: null, status: 'played', home: 'C', away: 'D', result: { home: 1, away: 1 } },
      { id: 'fx-3', kickoffAt: null, status: 'played', home: 'E', away: 'F', result: { home: 0, away: 3 } },
    ],
    memberCount: 3,
    predictedCount: 3,
    membersReturned: 3,
    membersTruncated: false,
    members: [
      {
        userId: 'u-1',
        displayName: 'Ann',
        isSelf: false,
        points: 13,
        settledAt: '2026-08-16T20:00:00Z',
        jokerPlayed: false,
        predictions: {
          'fx-1': { home: 2, away: 1 },
          'fx-2': { home: 1, away: 1 },
          'fx-3': { home: 0, away: 1 },
        },
      },
      {
        userId: 'u-2',
        displayName: 'Bob',
        isSelf: true,
        points: 8,
        settledAt: '2026-08-16T20:00:00Z',
        jokerPlayed: false,
        predictions: {
          'fx-1': { home: 3, away: 0 },
          'fx-2': { home: 2, away: 2 },
          'fx-3': { home: 0, away: 3 },
        },
      },
      {
        userId: 'u-3',
        displayName: 'Cal',
        isSelf: false,
        points: 3,
        settledAt: '2026-08-16T20:00:00Z',
        jokerPlayed: false,
        predictions: { 'fx-1': { home: 1, away: 0 } },
      },
    ],
    ...overrides,
  }
}

const movement: SeasonLeagueMovement = {
  leagueId: 'lg-1',
  matchweek: { id: 'mw-5', ordinal: 5, label: 'Matchweek 5' },
  settled: true,
  serverNow: null,
  members: [
    {
      userId: 'u-1',
      displayName: 'Ann',
      isSelf: false,
      pointsBefore: 40,
      pointsAfter: 53,
      pointsThisMatchweek: 13,
      rankBefore: 3,
      rankAfter: 1,
      movement: 2,
      gapToLeaderBefore: 6,
      gapToLeaderAfter: 0,
    },
    {
      userId: 'u-2',
      displayName: 'Bob',
      isSelf: true,
      pointsBefore: 46,
      pointsAfter: 54,
      pointsThisMatchweek: 8,
      rankBefore: 1,
      rankAfter: 1,
      movement: 0,
      gapToLeaderBefore: 0,
      gapToLeaderAfter: 0,
    },
  ],
}

describe('presentSideHonours', () => {
  it('awards nothing from a matchweek the server has not banked', () => {
    const honours = presentSideHonours(
      pageOf({
        members: pageOf().members.map((member) => ({ ...member, points: null })),
      }),
      null,
    )
    expect(honours.settled).toBe(false)
    expect(honours.honours).toEqual([])
  })

  it('awards nothing at all before the reveal', () => {
    const honours = presentSideHonours(
      pageOf({ revealed: false, members: [] }),
      null,
    )
    expect(honours.settled).toBe(false)
    expect(honours.honours).toEqual([])
  })

  it("takes the matchweek winner from the server's banked points", () => {
    const honours = presentSideHonours(pageOf(), null)
    const winner = honours.honours.find((honour) => honour.key === 'matchweek_winner')
    expect(winner?.winners.map((entry) => entry.displayName)).toEqual(['Ann'])
    expect(winner?.value).toBe('13 points')
  })

  it('counts exact scores against the confirmed results', () => {
    const honours = presentSideHonours(pageOf(), null)
    const king = honours.honours.find((honour) => honour.key === 'exact_scores')
    // Ann has fx-1 and fx-2 exact; Bob has fx-3.
    expect(king?.winners.map((entry) => entry.displayName)).toEqual(['Ann'])
    expect(king?.value).toBe('2 exact scores')
  })

  it('counts only draws that were predicted AND finished level', () => {
    const honours = presentSideHonours(pageOf(), null)
    const specialist = honours.honours.find((honour) => honour.key === 'draw_specialist')
    // Ann and Bob both predicted a draw on fx-2, which finished 1-1.
    expect(specialist?.winners.map((entry) => entry.displayName)).toEqual(['Ann', 'Bob'])
    expect(specialist?.value).toBe('1 draw called')
  })

  it('averages the goals error so a partial card is not penalised', () => {
    const honours = presentSideHonours(pageOf(), null)
    const guru = honours.honours.find((honour) => honour.key === 'goals_guru')
    // Ann: |3-3| + |2-2| + |1-3| = 2 over 3 = 0.7. Bob: 0 + 2 + 0 = 2 over 3 = 0.7.
    // Cal predicted one fixture, 1-0 against 2-1: 2 over 1 = 2.0.
    expect(guru?.winners.map((entry) => entry.displayName)).toEqual(['Ann', 'Bob'])
    expect(guru?.value).toBe('0.7 goals out per match')
  })

  it('awards biggest mover only from the matchweek the movement describes', () => {
    const matched = presentSideHonours(pageOf(), movement)
    const mover = matched.honours.find((honour) => honour.key === 'biggest_mover')
    expect(mover?.winners.map((entry) => entry.displayName)).toEqual(['Ann'])
    expect(mover?.value).toBe('up 2 places')

    const mismatched = presentSideHonours(pageOf(), {
      ...movement,
      matchweek: { id: 'mw-4', ordinal: 4, label: 'Matchweek 4' },
    })
    expect(mismatched.honours.some((honour) => honour.key === 'biggest_mover')).toBe(false)
  })

  it('awards no mover when nobody climbed', () => {
    const flat = presentSideHonours(pageOf(), {
      ...movement,
      members: movement.members.map((member) => ({ ...member, movement: 0 })),
    })
    expect(flat.honours.some((honour) => honour.key === 'biggest_mover')).toBe(false)
  })

  it('publishes a definition for every award it makes', () => {
    const honours = presentSideHonours(pageOf(), movement)
    expect(honours.honours.length).toBeGreaterThan(0)
    expect(honours.honours.every((honour) => honour.definition.length > 20)).toBe(true)
  })

  it('never awards a negative honour', () => {
    const honours = presentSideHonours(pageOf(), movement)
    expect(
      honours.honours.every((honour) => !/worst|wooden|spoon|loser/i.test(honour.title)),
    ).toBe(true)
  })

  it('carries the truncation flag so a partial league can say so', () => {
    const honours = presentSideHonours(
      pageOf({ membersTruncated: true, membersReturned: 3, memberCount: 400 }),
      null,
    )
    expect(honours.truncated).toBe(true)
    expect(honours.measured).toBe(3)
  })
})
