import { describe, expect, it } from 'vitest'
import { mapKoStandingsResponse } from '../../src/services/supabase/koPredictorStandingsModel'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    server_now: '2028-06-30T12:00:00+00:00',
    competition_id: 'comp-ko',
    standings: [
      {
        user_id: 'user-1',
        display_name: 'Alpha',
        rank: 1,
        total_points: 7,
        exact_count: 1,
        result_count: 0,
        through_count: 1,
        matches_scored: 1,
      },
      {
        user_id: 'user-2',
        display_name: 'Duo',
        rank: 2,
        total_points: 2,
        exact_count: 0,
        result_count: 0,
        through_count: 1,
        matches_scored: 1,
      },
    ],
    me: {
      rank: 1,
      total_points: 7,
      exact_count: 1,
      result_count: 0,
      through_count: 1,
      matches_scored: 1,
    },
    next_cursor: '2:user-2',
    ...overrides,
  }
}

describe('KO standings response parsing', () => {
  it('maps rows, caller context and the cursor', () => {
    const read = mapKoStandingsResponse(payload())
    expect(read.competitionId).toBe('comp-ko')
    expect(read.standings).toHaveLength(2)
    expect(read.standings[0]).toEqual({
      userId: 'user-1',
      displayName: 'Alpha',
      rank: 1,
      totalPoints: 7,
      exactCount: 1,
      resultCount: 0,
      throughCount: 1,
      matchesScored: 1,
    })
    expect(read.me?.totalPoints).toBe(7)
    expect(read.nextCursor).toBe('2:user-2')
  })

  it('maps a non-entrant caller and an exhausted page', () => {
    const read = mapKoStandingsResponse(payload({ me: null, next_cursor: null }))
    expect(read.me).toBeNull()
    expect(read.nextCursor).toBeNull()
  })

  it('rejects malformed rows instead of guessing', () => {
    expect(() =>
      mapKoStandingsResponse(
        payload({
          standings: [{ user_id: 'user-1', display_name: 'Alpha', rank: '1' }],
        }),
      ),
    ).toThrow('invalid rank')
    expect(() => mapKoStandingsResponse(payload({ server_now: 'soon' }))).toThrow(
      'invalid server time',
    )
    expect(() => mapKoStandingsResponse(null)).toThrow()
  })
})
