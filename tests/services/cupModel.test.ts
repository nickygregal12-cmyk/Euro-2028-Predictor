import { describe, expect, it } from 'vitest'
import { mapCupResponse } from '../../src/services/supabase/cupModel'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    server_now: '2028-06-05T12:00:00+00:00',
    competition_id: 'comp-cup',
    registration_closes_at: '2028-06-06T12:00:00+00:00',
    draw_completed_at: '2028-06-06T13:00:00+00:00',
    entrant: { joined_at: '2028-06-01T09:00:00+00:00', outcome: 'active' },
    entrant_count: 7,
    group_count: 2,
    my_group: {
      ordinal: 1,
      size: 4,
      members: [
        { user_id: 'user-1', display_name: 'Alpha', draw_number: 1 },
        { user_id: 'user-2', display_name: 'Beta', draw_number: 2 },
        { user_id: 'user-3', display_name: 'Gamma', draw_number: 3 },
        { user_id: 'user-4', display_name: 'Delta', draw_number: 4 },
      ],
    },
    my_fixtures: [
      {
        fixture_id: 'fix-1',
        stage: 'group',
        matchday: 1,
        window_label: 'Cup Matchday 1',
        window_opens_at: '2028-06-07T12:00:00+00:00',
        window_locks_at: '2028-06-09T13:00:00+00:00',
        opponent: { user_id: 'user-2', display_name: 'Beta' },
      },
    ],
    ...overrides,
  }
}

describe('Predictor Cup response parsing', () => {
  it('maps the drawn state with group, members and ties', () => {
    const read = mapCupResponse(payload())
    expect(read.competitionId).toBe('comp-cup')
    expect(read.drawCompletedAt).toBe('2028-06-06T13:00:00+00:00')
    expect(read.myGroup?.size).toBe(4)
    expect(read.myGroup?.members).toHaveLength(4)
    expect(read.myFixtures[0]).toEqual({
      fixtureId: 'fix-1',
      stage: 'group',
      matchday: 1,
      roundSize: null,
      bracketSlot: null,
      windowLabel: 'Cup Matchday 1',
      windowOpensAt: '2028-06-07T12:00:00+00:00',
      windowLocksAt: '2028-06-09T13:00:00+00:00',
      opponent: { userId: 'user-2', displayName: 'Beta' },
      myPoints: null,
      opponentPoints: null,
      decidedBy: null,
      status: 'pending',
      result: null,
    })
    expect(read.myMember).toBeNull()
    expect(read.penaltyNumber).toBeNull()
    expect(read.bracket).toBeNull()
    expect(read.champion).toBeNull()
    expect(read.goldenPredictor).toBeNull()
  })

  it('maps the knockout journey: seeds, penalty lane, bracket and honours', () => {
    const read = mapCupResponse(
      payload({
        completed_at: '2028-07-10T21:00:00+00:00',
        my_member: {
          draw_number: 1,
          group_position: 1,
          qualified_as: 'winner',
          seed: 2,
        },
        penalty_number: {
          window_id: 'w-6',
          window_label: 'Cup Final',
          lane: 'even',
          value: 2,
          version: 0,
          locks_at: '2028-07-09T19:00:00+00:00',
          locked: false,
        },
        bracket: [
          {
            stage: 'knockout',
            round_size: 2,
            bracket_slot: 1,
            window_sequence: 6,
            window_label: 'Cup Final',
            home: { user_id: 'user-1', display_name: 'Alpha' },
            away: { user_id: 'user-7', display_name: 'Eta' },
            winner_user_id: 'user-7',
            decided_by: 'penalty_number',
          },
        ],
        champion: { user_id: 'user-7', display_name: 'Eta' },
        golden_predictor: {
          top: [
            { user_id: 'user-1', display_name: 'Alpha', points: 23, rank: 1 },
          ],
          me: { points: 14, rank: 2 },
        },
      }),
    )
    expect(read.completedAt).toBe('2028-07-10T21:00:00+00:00')
    expect(read.myMember).toEqual({
      drawNumber: 1,
      groupPosition: 1,
      qualifiedAs: 'winner',
      seed: 2,
    })
    expect(read.penaltyNumber?.lane).toBe('even')
    expect(read.penaltyNumber?.locked).toBe(false)
    expect(read.bracket?.[0].decidedBy).toBe('penalty_number')
    expect(read.bracket?.[0].winnerUserId).toBe('user-7')
    expect(read.champion?.displayName).toBe('Eta')
    expect(read.goldenPredictor?.top[0].points).toBe(23)
    expect(read.goldenPredictor?.me?.rank).toBe(2)
  })

  it('rejects an unknown decider or penalty lane', () => {
    expect(() =>
      mapCupResponse(
        payload({
          bracket: [
            {
              stage: 'knockout',
              round_size: 2,
              bracket_slot: 1,
              window_sequence: 6,
              window_label: 'Cup Final',
              home: { user_id: 'user-1', display_name: 'Alpha' },
              away: { user_id: 'user-7', display_name: 'Eta' },
              winner_user_id: null,
              decided_by: 'coin_toss',
            },
          ],
        }),
      ),
    ).toThrow('unknown bracket decider')
    expect(() =>
      mapCupResponse(
        payload({
          penalty_number: {
            window_id: 'w-6',
            window_label: 'Cup Final',
            lane: 'prime',
            value: null,
            version: null,
            locks_at: null,
            locked: false,
          },
        }),
      ),
    ).toThrow('unknown penalty lane')
  })

  it('maps the pre-draw state', () => {
    const read = mapCupResponse(
      payload({ draw_completed_at: null, my_group: null, my_fixtures: [] }),
    )
    expect(read.drawCompletedAt).toBeNull()
    expect(read.myGroup).toBeNull()
    expect(read.myFixtures).toEqual([])
  })

  it('maps a settled fixture with points, result and standings', () => {
    const raw = payload()
    ;(raw.my_fixtures[0] as Record<string, unknown>).my_points = 8
    ;(raw.my_fixtures[0] as Record<string, unknown>).opponent_points = 3
    ;(raw.my_fixtures[0] as Record<string, unknown>).status = 'settled'
    ;(raw.my_fixtures[0] as Record<string, unknown>).result = 'win'
    ;(raw.my_group as Record<string, unknown>).standings = [
      {
        user_id: 'user-1',
        display_name: 'Alpha',
        position: 1,
        played: 1,
        wins: 1,
        draws: 0,
        losses: 0,
        points_for: 8,
        points_against: 3,
        table_points: 3,
        window_points: 8,
      },
    ]
    const read = mapCupResponse(raw)
    expect(read.myFixtures[0].myPoints).toBe(8)
    expect(read.myFixtures[0].result).toBe('win')
    expect(read.myFixtures[0].status).toBe('settled')
    expect(read.myGroup?.standings[0].tablePoints).toBe(3)
  })

  it('rejects malformed payloads instead of guessing', () => {
    expect(() =>
      mapCupResponse(
        payload({
          my_fixtures: [
            {
              fixture_id: 'fix-1',
              stage: 'semi',
              matchday: null,
              window_label: 'X',
              window_opens_at: null,
              window_locks_at: null,
              opponent: { user_id: 'u', display_name: 'V' },
            },
          ],
        }),
      ),
    ).toThrow('unknown fixture stage')
    expect(() => mapCupResponse(payload({ group_count: -1 }))).toThrow(
      'invalid group count',
    )
    expect(() => mapCupResponse(null)).toThrow()
  })
})
