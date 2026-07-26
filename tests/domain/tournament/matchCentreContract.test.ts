import { describe, expect, it, vi } from 'vitest'
import {
  calculateSourceMetadata,
  createEmptyMatchEnrichment,
  normalizeMatchLifecycleState,
  orderMatchEvents,
  type MatchEvent,
} from '../../../src/domain/tournament/matchCentreContract'
import { MATCH_CENTRE_SCENARIOS } from '../../../src/domain/tournament/matchCentreScenarios'

describe('normalizeMatchLifecycleState', () => {
  it.each([
    ['NS', 'SCHEDULED'],
    ['1H', 'LIVE_FIRST_HALF'],
    ['HT', 'HALF_TIME'],
    ['2H', 'LIVE_SECOND_HALF'],
    ['ET', 'EXTRA_TIME'],
    ['PEN', 'PENALTIES'],
    ['FT', 'FULL_TIME'],
    ['PST', 'POSTPONED'],
    ['SUSP', 'SUSPENDED'],
    ['CANC', 'CANCELLED'],
  ] as const)('normalizes %s to %s', (providerStatus, expected) => {
    expect(normalizeMatchLifecycleState(providerStatus, 'test')).toBe(expected)
  })

  it('fails closed and reports an unknown status without user or request context', () => {
    const report = vi.fn()

    expect(normalizeMatchLifecycleState('mystery-status', 'test-provider', report)).toBe(
      'SCHEDULED',
    )
    expect(report).toHaveBeenCalledWith({
      provider: 'test-provider',
      providerStatus: 'MYSTERY-STATUS',
    })
  })
})

describe('calculateSourceMetadata', () => {
  it('marks fresh verified data', () => {
    expect(
      calculateSourceMetadata({
        provider: 'test',
        fetchedAt: '2028-06-09T20:00:00.000Z',
        now: '2028-06-09T20:00:30.000Z',
        staleAfterSeconds: 60,
      }),
    ).toMatchObject({
      isStale: false,
      freshnessSeconds: 30,
      dataQuality: 'verified',
    })
  })

  it('marks data delayed only after the freshness threshold', () => {
    expect(
      calculateSourceMetadata({
        provider: 'test',
        fetchedAt: '2028-06-09T20:00:00.000Z',
        now: '2028-06-09T20:01:01.000Z',
        staleAfterSeconds: 60,
      }),
    ).toMatchObject({
      isStale: true,
      freshnessSeconds: 61,
      dataQuality: 'delayed',
    })
  })

  it('gives unavailable data precedence over delayed or provisional states', () => {
    expect(
      calculateSourceMetadata({
        provider: 'test',
        fetchedAt: '2028-06-09T20:00:00.000Z',
        now: '2028-06-09T20:02:00.000Z',
        staleAfterSeconds: 60,
        provisional: true,
        unavailable: true,
      }).dataQuality,
    ).toBe('unavailable')
  })
})

describe('Match Centre helpers and scenarios', () => {
  it('keeps every enrichment field optional by default', () => {
    expect(createEmptyMatchEnrichment()).toEqual({
      injuries: null,
      predictedLineups: null,
      expectedGoals: null,
      advancedPossession: null,
      headToHeadSummary: null,
      qualificationProbability: null,
    })
  })

  it('orders late or out-of-order events deterministically', () => {
    const events: MatchEvent[] = [
      {
        id: 'second',
        kind: 'goal',
        minute: 45,
        addedMinute: 2,
        teamId: null,
        playerName: null,
        secondaryPlayerName: null,
        label: 'Second',
        sequence: 2,
      },
      {
        id: 'first',
        kind: 'card',
        minute: 12,
        addedMinute: null,
        teamId: null,
        playerName: null,
        secondaryPlayerName: null,
        label: 'First',
        sequence: 1,
      },
      {
        id: 'third',
        kind: 'other',
        minute: null,
        addedMinute: null,
        teamId: null,
        playerName: null,
        secondaryPlayerName: null,
        label: 'Undated',
        sequence: 3,
      },
    ]

    expect(orderMatchEvents(events).map((event) => event.id)).toEqual([
      'first',
      'second',
      'third',
    ])
  })

  it('provides deterministic lifecycle, stale, unavailable and correction scenarios', () => {
    expect(MATCH_CENTRE_SCENARIOS.live.external.lifecycle).toBe('LIVE_SECOND_HALF')
    expect(MATCH_CENTRE_SCENARIOS.stale.external.source.dataQuality).toBe('delayed')
    expect(MATCH_CENTRE_SCENARIOS.unavailable.external.source.dataQuality).toBe('unavailable')
    expect(MATCH_CENTRE_SCENARIOS.corrected.external.events.at(-1)?.label).toContain(
      'corrected',
    )
  })
})
