import { describe, expect, it } from 'vitest'
import type { MatchSourceMetadata } from '../../../src/domain/tournament/matchCentreContract'
import {
  presentMatchLifecycle,
  shouldShowLivePulse,
  sourceFreshnessLabel,
  sourceQualityLabel,
} from '../../../src/domain/tournament/matchCentrePresentation'

function source(overrides: Partial<MatchSourceMetadata> = {}): MatchSourceMetadata {
  return {
    provider: 'mock',
    providerFixtureId: 'fixture-1',
    fetchedAt: '2028-06-10T18:00:00.000Z',
    providerUpdatedAt: '2028-06-10T18:00:00.000Z',
    isStale: false,
    freshnessSeconds: 15,
    dataQuality: 'verified',
    ...overrides,
  }
}

describe('Match Centre presentation mapping', () => {
  it('presents every important live period as live', () => {
    expect(presentMatchLifecycle('LIVE_FIRST_HALF').isLive).toBe(true)
    expect(presentMatchLifecycle('HALF_TIME').isLive).toBe(true)
    expect(presentMatchLifecycle('EXTRA_TIME').isLive).toBe(true)
    expect(presentMatchLifecycle('PENALTIES').isLive).toBe(true)
  })

  it('marks full-time and cancelled matches as terminal', () => {
    expect(presentMatchLifecycle('FULL_TIME').isTerminal).toBe(true)
    expect(presentMatchLifecycle('CANCELLED').isTerminal).toBe(true)
    expect(presentMatchLifecycle('POSTPONED').isTerminal).toBe(false)
  })

  it('does not add a quality warning for verified data', () => {
    expect(sourceQualityLabel(source())).toBeNull()
  })

  it('provides clear delayed and unavailable labels', () => {
    expect(sourceQualityLabel(source({ dataQuality: 'delayed' }))).toBe('Live data delayed')
    expect(sourceQualityLabel(source({ dataQuality: 'unavailable' }))).toBe(
      'Live data unavailable',
    )
  })

  it('formats stale freshness in minutes and hours', () => {
    expect(sourceFreshnessLabel(source({ isStale: true, freshnessSeconds: 9 * 60 }))).toBe(
      'Last updated 9 min ago.',
    )
    expect(sourceFreshnessLabel(source({ isStale: true, freshnessSeconds: 2 * 60 * 60 }))).toBe(
      'Last updated 2 hrs ago.',
    )
  })

  it('suppresses a live pulse when the live feed is unavailable', () => {
    expect(shouldShowLivePulse('LIVE_SECOND_HALF', source())).toBe(true)
    expect(
      shouldShowLivePulse('LIVE_SECOND_HALF', source({ dataQuality: 'unavailable' })),
    ).toBe(false)
    expect(shouldShowLivePulse('FULL_TIME', source())).toBe(false)
  })
})
