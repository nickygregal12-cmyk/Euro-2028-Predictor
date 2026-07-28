import { describe, expect, it } from 'vitest'
import { adjacentMatchRefs, orderMatchesForNavigation } from './matchNavigation'

describe('match navigation', () => {
  it('orders fixtures by kickoff and uses natural match references as the tie-breaker', () => {
    const ordered = orderMatchesForNavigation([
      { matchRef: 'M10', kickoffAt: '2028-06-10T20:00:00Z' },
      { matchRef: 'M2', kickoffAt: '2028-06-10T20:00:00Z' },
      { matchRef: 'M1', kickoffAt: '2028-06-09T20:00:00Z' },
      { matchRef: 'M3', kickoffAt: null },
    ])

    expect(ordered.map((match) => match.matchRef)).toEqual(['M1', 'M2', 'M10', 'M3'])
  })

  it('returns bounded previous and next references', () => {
    const matches = [
      { matchRef: 'M1', kickoffAt: '2028-06-09T20:00:00Z' },
      { matchRef: 'M2', kickoffAt: '2028-06-10T20:00:00Z' },
      { matchRef: 'M3', kickoffAt: '2028-06-11T20:00:00Z' },
    ]

    expect(adjacentMatchRefs(matches, 'M1')).toEqual({ previous: null, next: 'M2' })
    expect(adjacentMatchRefs(matches, 'M2')).toEqual({ previous: 'M1', next: 'M3' })
    expect(adjacentMatchRefs(matches, 'M3')).toEqual({ previous: 'M2', next: null })
    expect(adjacentMatchRefs(matches, 'missing')).toEqual({
      previous: null,
      next: null,
    })
  })
})
