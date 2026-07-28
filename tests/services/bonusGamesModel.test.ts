import { describe, expect, it } from 'vitest'
import { mapBonusGamesResponse } from '../../src/services/supabase/bonusGamesModel'

const TOURNAMENT = 'tournament-1'
const USER = 'user-1'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    server_now: '2028-06-27T12:00:00+00:00',
    competitions: [
      {
        id: 'comp-ko',
        game_key: 'ko_predictor',
        registration_opens_at: '2028-06-26T00:00:00+00:00',
        registration_closes_at: null,
        draw_required: false,
        draw_completed_at: null,
        completed_at: null,
        entrant: { joined_at: '2028-06-26T09:00:00+00:00', outcome: 'active' },
        windows: [
          {
            id: 'win-r16',
            sequence: 1,
            label: 'Round of 16',
            opens_at: '2028-06-26T12:00:00+00:00',
            locks_at: '2028-06-28T17:00:00+00:00',
            settles_at: null,
            requires_tie_break_input: false,
            fixtures: [
              { kickoff_at: '2028-06-29T15:00:00+00:00', result_state: 'scheduled' },
              { kickoff_at: null, result_state: 'confirmed' },
            ],
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('bonus games response parsing', () => {
  it('maps the hub payload into domain shapes', () => {
    const read = mapBonusGamesResponse(payload(), TOURNAMENT, USER)

    expect(read.serverNow).toBe('2028-06-27T12:00:00+00:00')
    expect(read.games).toHaveLength(1)

    const game = read.games[0]
    expect(game.competition).toEqual({
      id: 'comp-ko',
      gameKey: 'ko_predictor',
      tournamentId: TOURNAMENT,
      published: true,
      registrationOpensAt: '2028-06-26T00:00:00+00:00',
      registrationClosesAt: null,
      drawRequired: false,
      drawCompletedAt: null,
      completedAt: null,
    })
    expect(game.entrant).toEqual({
      competitionId: 'comp-ko',
      userId: USER,
      joinedAt: '2028-06-26T09:00:00+00:00',
      outcome: 'active',
      pendingInputs: 0,
    })
    expect(game.windows[0].competitionId).toBe('comp-ko')
    expect(game.windows[0].fixtures).toEqual([
      { kickoffAt: '2028-06-29T15:00:00+00:00', resultState: 'scheduled' },
      { kickoffAt: null, resultState: 'confirmed' },
    ])
  })

  it('maps a non-entrant to a null entrant', () => {
    const raw = payload()
    ;(raw.competitions[0] as Record<string, unknown>).entrant = null
    expect(mapBonusGamesResponse(raw, TOURNAMENT, USER).games[0].entrant).toBeNull()
  })

  it('rejects an unknown game instead of guessing', () => {
    const raw = payload()
    ;(raw.competitions[0] as Record<string, unknown>).game_key = 'sweepstake'
    expect(() => mapBonusGamesResponse(raw, TOURNAMENT, USER)).toThrow('unknown game')
  })

  it('rejects an unknown entrant outcome', () => {
    const raw = payload()
    ;(raw.competitions[0] as Record<string, unknown>).entrant = {
      joined_at: '2028-06-26T09:00:00+00:00',
      outcome: 'winner',
    }
    expect(() => mapBonusGamesResponse(raw, TOURNAMENT, USER)).toThrow('unknown entrant outcome')
  })

  it('rejects a malformed server instant', () => {
    expect(() =>
      mapBonusGamesResponse(payload({ server_now: 'soon' }), TOURNAMENT, USER),
    ).toThrow('invalid server time')
    expect(() => mapBonusGamesResponse(null, TOURNAMENT, USER)).toThrow()
  })

  it('rejects an unknown fixture result state', () => {
    const raw = payload()
    const windows = (raw.competitions[0] as { windows: { fixtures: unknown[] }[] }).windows
    windows[0].fixtures[0] = { kickoff_at: null, result_state: 'live' }
    expect(() => mapBonusGamesResponse(raw, TOURNAMENT, USER)).toThrow(
      'unknown fixture result state',
    )
  })

  it('accepts an empty hub', () => {
    expect(
      mapBonusGamesResponse(
        { server_now: '2028-06-27T12:00:00+00:00', competitions: [] },
        TOURNAMENT,
        USER,
      ).games,
    ).toEqual([])
  })
})
