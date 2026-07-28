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
      windowLabel: 'Cup Matchday 1',
      windowOpensAt: '2028-06-07T12:00:00+00:00',
      windowLocksAt: '2028-06-09T13:00:00+00:00',
      opponent: { userId: 'user-2', displayName: 'Beta' },
    })
  })

  it('maps the pre-draw state', () => {
    const read = mapCupResponse(
      payload({ draw_completed_at: null, my_group: null, my_fixtures: [] }),
    )
    expect(read.drawCompletedAt).toBeNull()
    expect(read.myGroup).toBeNull()
    expect(read.myFixtures).toEqual([])
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
