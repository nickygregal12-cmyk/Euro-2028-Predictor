import { describe, it, expect } from 'vitest'
import {
  isGroupComplete,
  groupContinuation,
} from '../../../src/features/predict/groupContinuation'
import type { Prediction } from '../../../src/app/providers/PredictionsProvider'

const empty: Prediction = { homeScore: null, awayScore: null, joker: false }
const filled = (h: number, a: number): Prediction => ({
  homeScore: h,
  awayScore: a,
  joker: false,
})

function lookup(map: Record<string, Prediction>) {
  return (id: string): Prediction => map[id] ?? empty
}

describe('isGroupComplete', () => {
  const matches = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }]

  it('is false when no matches (never "complete" on an empty group)', () => {
    expect(isGroupComplete([], lookup({}))).toBe(false)
  })

  it('is false while any match is unpredicted', () => {
    expect(
      isGroupComplete(matches, lookup({ m1: filled(1, 0), m2: filled(2, 2) })),
    ).toBe(false)
  })

  it('is false when one side of a score is missing', () => {
    const half: Prediction = { homeScore: 1, awayScore: null, joker: false }
    expect(
      isGroupComplete(
        matches,
        lookup({ m1: filled(1, 0), m2: filled(2, 2), m3: half }),
      ),
    ).toBe(false)
  })

  it('is true when every match has both scores (0–0 counts)', () => {
    expect(
      isGroupComplete(
        matches,
        lookup({ m1: filled(0, 0), m2: filled(2, 1), m3: filled(3, 3) }),
      ),
    ).toBe(true)
  })
})

describe('groupContinuation', () => {
  it('points Groups A–E at the next letter', () => {
    expect(groupContinuation('A')).toEqual({
      label: 'Next: Group B →',
      path: '/predict/groups/B',
    })
    expect(groupContinuation('E')).toEqual({
      label: 'Next: Group F →',
      path: '/predict/groups/F',
    })
  })

  it('points Group F at Finalise Group Standings', () => {
    expect(groupContinuation('F')).toEqual({
      label: 'Next: Finalise Group Standings →',
      path: '/predict/third-place',
    })
  })

  it('is case-insensitive on the letter', () => {
    expect(groupContinuation('c')?.path).toBe('/predict/groups/D')
  })

  it('returns null for an unknown group', () => {
    expect(groupContinuation('Z')).toBeNull()
  })
})
