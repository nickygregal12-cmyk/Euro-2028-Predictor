import { describe, expect, it } from 'vitest'
import { MATCH_LIFECYCLE_STATES } from '../../../src/domain/tournament/matchCentreContract'
import { matchCentreLifecycleContent } from '../../../src/domain/tournament/matchCentreLifecycleContent'

describe('matchCentreLifecycleContent', () => {
  it('defines repository-owned content for every canonical lifecycle state', () => {
    expect(MATCH_LIFECYCLE_STATES).toHaveLength(11)

    for (const lifecycle of MATCH_LIFECYCLE_STATES) {
      const content = matchCentreLifecycleContent(lifecycle)

      expect(content.heading.length).toBeGreaterThan(0)
      expect(content.summary.length).toBeGreaterThan(0)
      expect(content.showPredictionContext).toBeTypeOf('boolean')
      expect(content.showMatchImpact).toBeTypeOf('boolean')
    }
  })

  it('shows match impact only while play is active or once a result is complete', () => {
    const impactStates = MATCH_LIFECYCLE_STATES.filter(
      (lifecycle) => matchCentreLifecycleContent(lifecycle).showMatchImpact,
    )

    expect(impactStates).toEqual([
      'LIVE_FIRST_HALF',
      'HALF_TIME',
      'LIVE_SECOND_HALF',
      'EXTRA_TIME',
      'PENALTIES',
      'FULL_TIME',
    ])
  })

  it('uses interruption emphasis for postponed, suspended and cancelled fixtures', () => {
    expect(matchCentreLifecycleContent('POSTPONED').emphasis).toBe('warning')
    expect(matchCentreLifecycleContent('SUSPENDED').emphasis).toBe('danger')
    expect(matchCentreLifecycleContent('CANCELLED').emphasis).toBe('danger')
  })

  it('keeps prediction context available in every lifecycle state', () => {
    for (const lifecycle of MATCH_LIFECYCLE_STATES) {
      expect(matchCentreLifecycleContent(lifecycle).showPredictionContext).toBe(true)
    }
  })
})
