import { describe, expect, it } from 'vitest'
import {
  createProviderSourceStamp,
  ENRICHMENT_PROVIDER_NAMES,
  evaluateProviderFreshness,
  hasImplementedProviderCapability,
  POLLED_PROVIDER_NAMES,
  PROVIDER_CAPABILITIES,
  PROVIDER_ENRICHMENT_AUTHORITY,
  type ProviderCapability,
} from '../../supabase/functions/provider-poll/enrichmentContract'
import {
  decodeApiFootball,
  decodeFootballData,
  decodeSportMonks,
} from '../../supabase/functions/provider-poll/providerDecoders'

const richerFootballContext: ProviderCapability[] = [
  'team-profile',
  'player-profile',
  'venue',
  'standings',
  'kit-colours',
  'confirmed-lineup',
  'predicted-lineup',
  'match-events',
  'match-statistics',
  'injuries-suspensions',
]

describe('provider enrichment capability contract', () => {
  it('describes every provider the poll function currently accepts plus the unverified SportDB candidate', () => {
    expect(POLLED_PROVIDER_NAMES).toEqual([
      'sportmonks',
      'api-football',
      'football-data',
      'the-odds-api',
    ])
    expect(ENRICHMENT_PROVIDER_NAMES).toEqual([
      ...POLLED_PROVIDER_NAMES,
      'sportdb-dev',
    ])
    expect(Object.keys(PROVIDER_CAPABILITIES).sort()).toEqual(
      [...ENRICHMENT_PROVIDER_NAMES].sort(),
    )
  })

  it('marks only capabilities with a current repository decoder/import path as implemented', () => {
    expect(PROVIDER_CAPABILITIES.sportmonks.implemented).toEqual(['fixture-evidence'])
    expect(PROVIDER_CAPABILITIES['api-football'].implemented).toEqual(['fixture-evidence'])
    expect(PROVIDER_CAPABILITIES['football-data'].implemented).toEqual(['fixture-evidence'])
    expect(PROVIDER_CAPABILITIES['the-odds-api'].implemented).toEqual(['odds-market'])
    expect(PROVIDER_CAPABILITIES['sportdb-dev']).toMatchObject({
      runtimeState: 'candidate-unverified',
      implemented: [],
    })
  })

  it('does not accidentally promote richer football context before subscription and payload evidence exists', () => {
    for (const provider of ['sportmonks', 'api-football', 'football-data'] as const) {
      for (const capability of richerFootballContext) {
        expect(
          hasImplementedProviderCapability(provider, capability),
          `${provider} must not claim ${capability} as implemented yet`,
        ).toBe(false)
      }
    }
  })

  it('keeps the capability registry aligned with the three fixture decoders that exist today', () => {
    expect(
      decodeSportMonks({
        data: [
          {
            id: 1,
            starting_at_timestamp: 1785682800,
            state_id: 1,
            participants: [
              { id: 10, name: 'Home', meta: { location: 'home' } },
              { id: 11, name: 'Away', meta: { location: 'away' } },
            ],
          },
        ],
      })[0]?.provider,
    ).toBe('sportmonks')
    expect(
      decodeApiFootball({
        response: [
          {
            fixture: {
              id: 2,
              date: '2026-08-02T15:00:00Z',
              status: { short: 'NS' },
            },
            league: {},
            teams: {
              home: { id: 20, name: 'Home' },
              away: { id: 21, name: 'Away' },
            },
            goals: { home: null, away: null },
          },
        ],
      })[0]?.provider,
    ).toBe('api-football')
    expect(
      decodeFootballData({
        matches: [
          {
            id: 3,
            utcDate: '2026-08-02T15:00:00Z',
            status: 'SCHEDULED',
            homeTeam: { id: 30, name: 'Home' },
            awayTeam: { id: 31, name: 'Away' },
            score: { fullTime: { home: null, away: null } },
          },
        ],
      })[0]?.provider,
    ).toBe('football-data')
  })
})

describe('provider enrichment provenance and freshness', () => {
  it('stamps provider data as enrichment-only rather than competitive truth', () => {
    expect(
      createProviderSourceStamp(
        'api-football',
        '2026-08-20T12:00:00.000Z',
        'fixture-123',
      ),
    ).toEqual({
      provider: 'api-football',
      providerEntityId: 'fixture-123',
      fetchedAt: '2026-08-20T12:00:00.000Z',
      authority: PROVIDER_ENRICHMENT_AUTHORITY,
    })
    expect(PROVIDER_ENRICHMENT_AUTHORITY).toBe('enrichment-only')
  })

  it('treats the exact maximum age as fresh and one millisecond later as stale', () => {
    const fetchedAt = '2026-08-20T12:00:00.000Z'
    const maxAgeMs = 60_000

    expect(
      evaluateProviderFreshness(
        fetchedAt,
        maxAgeMs,
        '2026-08-20T12:01:00.000Z',
      ),
    ).toEqual({ state: 'fresh', ageMs: 60_000 })
    expect(
      evaluateProviderFreshness(
        fetchedAt,
        maxAgeMs,
        '2026-08-20T12:01:00.001Z',
      ),
    ).toEqual({ state: 'stale', ageMs: 60_001 })
  })

  it.each([
    ['not-a-date', '2026-08-20T12:00:00.000Z'],
    ['2026-08-20T12:00:00.000Z', 'not-a-date'],
    ['2026-08-20T12:01:00.000Z', '2026-08-20T12:00:00.000Z'],
  ])('fails invalid or future freshness evidence closed to unknown', (fetchedAt, now) => {
    expect(evaluateProviderFreshness(fetchedAt, 60_000, now)).toEqual({
      state: 'unknown',
      ageMs: null,
    })
  })

  it.each([-1, Number.POSITIVE_INFINITY, Number.NaN])(
    'rejects an invalid freshness budget (%s)',
    (maxAgeMs) => {
      expect(() =>
        evaluateProviderFreshness(
          '2026-08-20T12:00:00.000Z',
          maxAgeMs,
          '2026-08-20T12:00:00.000Z',
        ),
      ).toThrow(RangeError)
    },
  )
})
