import { describe, expect, it } from 'vitest'
import { mapLmsResponse } from '../../src/services/supabase/lmsModel'
import { at } from '../support/indexed'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    server_now: '2028-06-09T12:00:00+00:00',
    competition_id: 'comp-lms',
    entrant: { joined_at: '2028-06-01T09:00:00+00:00', outcome: 'survived' },
    entrant_count: 5,
    remaining_count: 2,
    used_team_ids: ['team-a'],
    windows: [
      {
        id: 'win-md1',
        sequence: 1,
        label: 'Matchday 1',
        opens_at: '2028-06-07T12:00:00+00:00',
        locks_at: '2028-06-09T13:00:00+00:00',
        settles_at: null,
        my_selection: { team_id: 'team-a', version: 1 },
        fixtures: [
          {
            match_id: 'match-1',
            round: 'group',
            kickoff_at: '2028-06-09T14:00:00+00:00',
            home_team_id: 'team-a',
            away_team_id: 'team-b',
            result_state: 'scheduled',
            home_score: null,
            away_score: null,
            winner_team_id: null,
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('Last Man Standing response parsing', () => {
  it('maps entrant state, counts, used teams and rounds', () => {
    const read = mapLmsResponse(payload())
    expect(read.competitionId).toBe('comp-lms')
    expect(read.entrant).toEqual({
      joinedAt: '2028-06-01T09:00:00+00:00',
      outcome: 'survived',
    })
    expect(read.entrantCount).toBe(5)
    expect(read.remainingCount).toBe(2)
    expect(read.usedTeamIds).toEqual(['team-a'])
    expect(read.windows[0]?.mySelection).toEqual({ teamId: 'team-a', version: 1 })
    expect(read.windows[0]?.fixtures[0]?.homeTeamId).toBe('team-a')
  })

  it('maps a non-entrant and a pickless round', () => {
    const raw = payload({ entrant: null })
    ;(raw.windows[0] as Record<string, unknown>).my_selection = null
    const read = mapLmsResponse(raw)
    expect(read.entrant).toBeNull()
    expect(read.windows[0]?.mySelection).toBeNull()
  })

  it('rejects malformed payloads instead of guessing', () => {
    expect(() =>
      mapLmsResponse(payload({ entrant: { joined_at: 'x', outcome: 'winner' } })),
    ).toThrow('unknown entrant outcome')
    expect(() => mapLmsResponse(payload({ remaining_count: '2' }))).toThrow(
      'invalid remaining count',
    )
    const raw = payload()
    ;at((raw.windows[0] as { fixtures: Record<string, unknown>[] }).fixtures, 0).result_state =
      'live'
    expect(() => mapLmsResponse(raw)).toThrow('unknown fixture result state')
    expect(() => mapLmsResponse(null)).toThrow()
  })
})
