import { describe, expect, it } from 'vitest';
import {
  decodeApiFootball,
  decodeFootballData,
  decodeSportMonks,
  ProviderDecodeError,
} from '../../supabase/functions/provider-poll/providerDecoders';

describe('provider fixture decoders', () => {
  it('decodes SportMonks participants and current scores', () => {
    expect(
      decodeSportMonks({
        data: [
          {
            id: 10,
            league_id: 20,
            season_id: 30,
            round_id: 40,
            starting_at: '2026-08-02T15:00:00Z',
            state_id: 5,
            participants: [
              { id: 1, meta: { location: 'home' } },
              { id: 2, meta: { location: 'away' } },
            ],
            scores: [
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
        homeTeamProviderId: '1',
        awayTeamProviderId: '2',
        homeScore: 2,
        awayScore: 1,
      }),
    ]);
  });

  it('decodes API-Football without accepting malformed goal values', () => {
    const valid = {
      response: [
        {
          fixture: { id: 11, date: '2026-08-02T15:00:00+00:00', status: { short: 'FT' } },
          league: { id: 21, season: 2026, round: 'Regular Season - 1' },
          teams: { home: { id: 3 }, away: { id: 4 } },
          goals: { home: 3, away: 0 },
        },
      ],
    };
    expect(decodeApiFootball(valid)[0]).toMatchObject({
      providerFixtureId: '11',
      homeScore: 3,
      awayScore: 0,
      status: 'FT',
    });
    expect(() =>
      decodeApiFootball({
        ...valid,
        response: [{ ...valid.response[0], goals: { home: '3', away: 0 } }],
      }),
    ).toThrow(ProviderDecodeError);
  });

  it('decodes football-data.org full-time scores', () => {
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
            homeTeam: { id: 5 },
            awayTeam: { id: 6 },
            score: { fullTime: { home: 1, away: 1 } },
          },
        ],
      })[0],
    ).toMatchObject({
      provider: 'football-data',
      providerFixtureId: '12',
      competitionProviderId: '2021',
      homeScore: 1,
      awayScore: 1,
    });
  });

  it.each([
    ['sportmonks', () => decodeSportMonks({ data: [{}] })],
    ['api-football', () => decodeApiFootball({ response: [{}] })],
    ['football-data', () => decodeFootballData({ matches: [{}] })],
  ])('fails closed when the %s contract is incomplete', (_provider, decode) => {
    expect(decode).toThrow(ProviderDecodeError);
  });
});
