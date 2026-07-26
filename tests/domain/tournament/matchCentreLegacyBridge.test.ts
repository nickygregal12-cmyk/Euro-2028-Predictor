import { describe, expect, it } from 'vitest'
import {
  bridgeExternalMatchToLegacyHeader,
  lifecycleToLegacyTemporalState,
} from '../../../src/domain/tournament/matchCentreLegacyBridge'
import type { ExternalMatchData } from '../../../src/domain/tournament/matchCentreContract'

function external(overrides: Partial<ExternalMatchData> = {}): ExternalMatchData {
  return {
    fixtureId: 'fixture-1',
    matchRef: 'M01',
    kickoffAt: '2028-06-09T20:00:00.000Z',
    lifecycle: 'SCHEDULED',
    clockLabel: null,
    venue: 'Wembley Stadium',
    referee: null,
    home: { id: 'home', name: 'Scotland', countryCode: 'SCO' },
    away: { id: 'away', name: 'Germany', countryCode: 'GER' },
    score: null,
    events: [],
    lineups: { home: null, away: null },
    statistics: [],
    source: {
      provider: 'repository',
      providerFixtureId: null,
      fetchedAt: '2028-06-09T18:00:00.000Z',
      providerUpdatedAt: null,
      isStale: false,
      freshnessSeconds: 0,
      dataQuality: 'provisional',
    },
    ...overrides,
  }
}

describe('lifecycleToLegacyTemporalState', () => {
  it.each([
    ['SCHEDULED', 'before'],
    ['PRE_MATCH', 'before'],
    ['POSTPONED', 'before'],
    ['SUSPENDED', 'before'],
    ['LIVE_FIRST_HALF', 'during'],
    ['HALF_TIME', 'during'],
    ['LIVE_SECOND_HALF', 'during'],
    ['EXTRA_TIME', 'during'],
    ['PENALTIES', 'during'],
    ['FULL_TIME', 'after'],
    ['CANCELLED', 'after'],
  ] as const)('maps %s to %s', (lifecycle, expected) => {
    expect(lifecycleToLegacyTemporalState(lifecycle)).toBe(expected)
  })
})

describe('bridgeExternalMatchToLegacyHeader', () => {
  it('maps normalized teams, status and source into existing screen props', () => {
    const input = external({
      lifecycle: 'LIVE_SECOND_HALF',
      clockLabel: "67'",
      score: { home: 2, away: 1 },
    })

    const bridged = bridgeExternalMatchToLegacyHeader(input)

    expect(bridged.temporalState).toBe('during')
    expect(bridged.statusPresentation.label).toBe('Live · second half')
    expect(bridged.matchSource).toBe(input.source)
    expect(bridged.home).toEqual({ name: 'Scotland', countryCode: 'SCO' })
    expect(bridged.away).toEqual({ name: 'Germany', countryCode: 'GER' })
    expect(bridged.result).toEqual({ home: 2, away: 1 })
    expect(bridged.liveMinute).toBe("67'")
  })

  it('normalizes absent country codes and score for the legacy screen', () => {
    const bridged = bridgeExternalMatchToLegacyHeader(
      external({
        home: { id: null, name: 'Winner Match 1', countryCode: null },
        away: { id: null, name: 'Winner Match 2', countryCode: null },
      }),
    )

    expect(bridged.home.countryCode).toBe('')
    expect(bridged.away.countryCode).toBe('')
    expect(bridged.result).toBeNull()
    expect(bridged.temporalState).toBe('before')
  })
})
