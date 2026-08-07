import { describe, expect, it } from 'vitest'
import {
  decodeApiFootball,
  decodeFootballData,
  decodeSportMonks,
  ProviderDecodeError,
} from '../../supabase/functions/provider-poll/providerDecoders'

describe('provider fixture decoders', () => {
  it('decodes SportMonks participants, meaningful round, UTC timestamp and CURRENT scores', () => {
    expect(
      decodeSportMonks({
        data: [
          {
            id: 10,
            league_id: 20,
            season_id: 30,
            round_id: 407973,
            round: { id: 407973, name: '1' },
            starting_at: '2026-08-02 15:00:00',
            starting_at_timestamp: 1785682800,
            state_id: 5,
            participants: [
              { id: 1, name: 'Home FC', meta: { location: 'home' } },
              { id: 2, name: 'Away FC', meta: { location: 'away' } },
            ],
            scores: [
              { participant_id: 1, description: '1ST_HALF', score: { goals: 1 } },
              { participant_id: 2, description: '1ST_HALF', score: { goals: 0 } },
              { participant_id: 1, description: 'CURRENT', score: { goals: 2 } },
              { participant_id: 2, description: 'CURRENT', score: { goals: 1 } },
            ],
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        provider: 'sportmonks',
        providerFixtureId: '10',
        roundProviderId: '1',
        homeTeamProviderId: '1',
        homeTeamName: 'Home FC',
        awayTeamProviderId: '2',
        awayTeamName: 'Away FC',
        kickoffAt: '2026-08-02T15:00:00.000Z',
        homeScore: 2,
        awayScore: 1,
      }),
    ])
  })

  it('falls back to the SportMonks round row id only when round detail is absent', () => {
    expect(
      decodeSportMonks({
        data: [
          {
            id: 10,
            round_id: 407973,
            starting_at_timestamp: 1785682800,
            state_id: 1,
            participants: [
              { id: 1, name: 'Home FC', meta: { location: 'home' } },
              { id: 2, name: 'Away FC', meta: { location: 'away' } },
            ],
          },
        ],
      })[0],
    ).toMatchObject({ roundProviderId: '407973' })
  })

  it('fails closed when an included SportMonks round has no meaningful name', () => {
    expect(() =>
      decodeSportMonks({
        data: [
          {
            id: 10,
            round_id: 407973,
            round: { id: 407973 },
            starting_at_timestamp: 1785682800,
            state_id: 1,
            participants: [
              { id: 1, name: 'Home FC', meta: { location: 'home' } },
              { id: 2, name: 'Away FC', meta: { location: 'away' } },
            ],
          },
        ],
      }),
    ).toThrow(/round\.name/)
  })

  it('decodes API-Football names without accepting malformed goal values', () => {
    const valid = {
      response: [
        {
          fixture: {
            id: 11,
            date: '2026-08-02T15:00:00+00:00',
            status: { short: 'FT' },
          },
          league: { id: 21, season: 2026, round: 'Regular Season - 1' },
          teams: {
            home: { id: 3, name: 'Home United' },
            away: { id: 4, name: 'Away City' },
          },
          goals: { home: 3, away: 0 },
        },
      ],
    }

    expect(decodeApiFootball(valid)[0]).toMatchObject({
      providerFixtureId: '11',
      homeTeamName: 'Home United',
      awayTeamName: 'Away City',
      homeScore: 3,
      awayScore: 0,
      status: 'FT',
    })
    expect(() =>
      decodeApiFootball({
        ...valid,
        response: [{ ...valid.response[0], goals: { home: '3', away: 0 } }],
      }),
    ).toThrow(ProviderDecodeError)
  })

  it('decodes football-data.org names and full-time scores', () => {
    expect(
      decodeFootballData({
        competition: { id: 2021 },
        matches: [
          {
            id: 12,
            season: { id: 2026 },
            matchday: 1,
            utcDate: '2026-08-02T15:00:00Z',
            status: 'FINISHED',
            homeTeam: { id: 5, name: 'Home Athletic' },
            awayTeam: { id: 6, name: 'Away Rovers' },
            score: { fullTime: { home: 1, away: 1 } },
          },
        ],
      })[0],
    ).toMatchObject({
      provider: 'football-data',
      providerFixtureId: '12',
      competitionProviderId: '2021',
      homeTeamName: 'Home Athletic',
      awayTeamName: 'Away Rovers',
      homeScore: 1,
      awayScore: 1,
    })
  })

  it.each([
    ['sportmonks', () => decodeSportMonks({ data: [{}] })],
    ['api-football', () => decodeApiFootball({ response: [{}] })],
    ['football-data', () => decodeFootballData({ matches: [{}] })],
  ])('fails closed when the %s contract is incomplete', (_provider, decode) => {
    expect(decode).toThrow(ProviderDecodeError)
  })

  it('rejects duplicate fixture identities in one provider response', () => {
    const fixture = {
      fixture: { id: 11, date: '2026-08-02T15:00:00Z', status: { short: 'NS' } },
      league: { id: 21, season: 2026, round: 'Regular Season - 1' },
      teams: {
        home: { id: 3, name: 'Home United' },
        away: { id: 4, name: 'Away City' },
      },
      goals: { home: null, away: null },
    }
    expect(() => decodeApiFootball({ response: [fixture, fixture] })).toThrow(
      /duplicate fixture identifier 11/,
    )
  })

  it('rejects the same team on both sides of a fixture', () => {
    expect(() =>
      decodeFootballData({
        matches: [
          {
            id: 12,
            utcDate: '2026-08-02T15:00:00Z',
            status: 'SCHEDULED',
            homeTeam: { id: 5, name: 'Same FC' },
            awayTeam: { id: 5, name: 'Same FC' },
            score: { fullTime: { home: null, away: null } },
          },
        ],
      }),
    ).toThrow(/home and away teams must differ/)
  })

  it('requires provider club names for initial fixture adoption evidence', () => {
    expect(() =>
      decodeApiFootball({
        response: [
          {
            fixture: { id: 11, date: '2026-08-02T15:00:00Z', status: { short: 'NS' } },
            league: { id: 21, season: 2026, round: 'Regular Season - 1' },
            teams: { home: { id: 3 }, away: { id: 4, name: 'Away City' } },
            goals: { home: null, away: null },
          },
        ],
      }),
    ).toThrow(/teams\.home\.name/)
  })

  it('requires the official SportMonks UTC timestamp instead of guessing its timezone-free display value', () => {
    expect(() =>
      decodeSportMonks({
        data: [
          {
            id: 10,
            starting_at: '2026-08-02 15:00:00',
            participants: [
              { id: 1, name: 'Home FC', meta: { location: 'home' } },
              { id: 2, name: 'Away FC', meta: { location: 'away' } },
            ],
          },
        ],
      }),
    ).toThrow(/Unix timestamp in seconds/)
  })
})
