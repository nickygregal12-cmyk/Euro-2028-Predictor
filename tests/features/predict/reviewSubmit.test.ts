import { describe, it, expect } from 'vitest'
import { submitBlockers, firstBlocker } from '../../../src/features/predict/reviewSubmit'
import type { HubStatus } from '../../../src/features/predict/hubStatus'

// A fully-complete status; each test overrides one stage to make it a blocker.
function status(over: Partial<HubStatus> = {}): HubStatus {
  return {
    groups: { predicted: 36, total: 36, complete: true },
    thirdPlace: { state: 'settled', tieCount: 0 },
    bracket: { picked: 15, total: 15 },
    jokers: { placed: 5, total: 5 },
    reviewUnlocked: true,
    overallPercent: 100,
    ...over,
  }
}

describe('submitBlockers', () => {
  it('is empty when everything is complete', () => {
    expect(submitBlockers(status())).toEqual([])
  })

  it('flags incomplete groups', () => {
    const b = submitBlockers(status({ groups: { predicted: 30, total: 36, complete: false } }))
    expect(b).toEqual([{ label: 'Groups A–F', route: '/predict/groups/A' }])
  })

  it('flags pending third-place ties', () => {
    const b = submitBlockers(status({ thirdPlace: { state: 'ties', tieCount: 2 } }))
    expect(b).toEqual([{ label: 'Best third-placed teams', route: '/predict/third-place' }])
  })

  it('flags an incomplete bracket', () => {
    const b = submitBlockers(status({ bracket: { picked: 12, total: 15 } }))
    expect(b).toEqual([{ label: 'Knockout bracket', route: '/predict/bracket' }])
  })

  it('never flags jokers (optional)', () => {
    expect(submitBlockers(status({ jokers: { placed: 0, total: 5 } }))).toEqual([])
  })

  it('orders groups → thirds → bracket', () => {
    const b = submitBlockers(
      status({
        groups: { predicted: 0, total: 36, complete: false },
        thirdPlace: { state: 'blocked', tieCount: 0 },
        bracket: { picked: 0, total: 15 },
      }),
    )
    expect(b.map((x) => x.label)).toEqual([
      'Groups A–F',
      'Best third-placed teams',
      'Knockout bracket',
    ])
  })
})

describe('firstBlocker', () => {
  it('is null when submittable', () => {
    expect(firstBlocker(status())).toBeNull()
  })

  it('returns the first in checklist order — thirds before bracket', () => {
    expect(
      firstBlocker(
        status({
          thirdPlace: { state: 'ties', tieCount: 1 },
          bracket: { picked: 10, total: 15 },
        }),
      ),
    ).toEqual({ label: 'Best third-placed teams', route: '/predict/third-place' })
  })

  it('groups win over everything', () => {
    expect(
      firstBlocker(
        status({
          groups: { predicted: 1, total: 36, complete: false },
          thirdPlace: { state: 'blocked', tieCount: 0 },
          bracket: { picked: 0, total: 15 },
        }),
      ),
    ).toEqual({ label: 'Groups A–F', route: '/predict/groups/A' })
  })
})
