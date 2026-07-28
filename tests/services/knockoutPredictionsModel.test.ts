import { describe, expect, it } from 'vitest'
import { mapKnockoutStoreResponse } from '../../src/services/supabase/knockoutPredictionsModel'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    server_now: '2028-06-27T12:00:00+00:00',
    store_entrant: true,
    predictions: [
      {
        match_id: 'match-1',
        home_score: 2,
        away_score: 1,
        advancing_team_id: null,
        version: 0,
      },
      {
        match_id: 'match-2',
        home_score: 1,
        away_score: 1,
        advancing_team_id: 'team-a',
        version: 3,
      },
    ],
    ...overrides,
  }
}

describe('knockout store response parsing', () => {
  it('maps the store payload', () => {
    const read = mapKnockoutStoreResponse(payload())
    expect(read.serverNow).toBe('2028-06-27T12:00:00+00:00')
    expect(read.storeEntrant).toBe(true)
    expect(read.predictions).toEqual([
      { matchId: 'match-1', homeScore: 2, awayScore: 1, advancingTeamId: null, version: 0 },
      { matchId: 'match-2', homeScore: 1, awayScore: 1, advancingTeamId: 'team-a', version: 3 },
    ])
  })

  it('rejects an inconsistent through pick instead of guessing', () => {
    expect(() =>
      mapKnockoutStoreResponse(
        payload({
          predictions: [
            { match_id: 'm', home_score: 2, away_score: 1, advancing_team_id: 'team-a', version: 0 },
          ],
        }),
      ),
    ).toThrow('inconsistent through pick')

    expect(() =>
      mapKnockoutStoreResponse(
        payload({
          predictions: [
            { match_id: 'm', home_score: 1, away_score: 1, advancing_team_id: null, version: 0 },
          ],
        }),
      ),
    ).toThrow('inconsistent through pick')
  })

  it('rejects malformed scores, versions and server time', () => {
    expect(() =>
      mapKnockoutStoreResponse(
        payload({
          predictions: [
            { match_id: 'm', home_score: '2', away_score: 1, advancing_team_id: null, version: 0 },
          ],
        }),
      ),
    ).toThrow('invalid home score')
    expect(() => mapKnockoutStoreResponse(payload({ server_now: 'soon' }))).toThrow(
      'invalid server time',
    )
    expect(() => mapKnockoutStoreResponse(payload({ store_entrant: 'yes' }))).toThrow(
      'invalid entrant flag',
    )
    expect(() => mapKnockoutStoreResponse(null)).toThrow()
  })

  it('accepts an empty store for a non-entrant', () => {
    const read = mapKnockoutStoreResponse({
      server_now: '2028-06-27T12:00:00+00:00',
      store_entrant: false,
      predictions: [],
    })
    expect(read.storeEntrant).toBe(false)
    expect(read.predictions).toEqual([])
  })
})
