import { describe, it, expect } from 'vitest'
import { completedMatchdays, type MatchState } from '../../src/domain/tournament/rankHistory'

// Six group matches per matchday (2 per group × 6 groups); knockout rounds have
// their own match counts. `md(n, resulted)` builds a group matchday's matches.
function groupMatchday(matchday: number, resulted: number): MatchState[] {
  return Array.from({ length: 6 }, (_, i) => ({
    round: 'group',
    matchday,
    hasResult: i < resulted,
  }))
}

describe('completedMatchdays (capture points)', () => {
  it('captures nothing before any matchday is fully scored', () => {
    // First results are in, but MD1 is only partially scored → no snapshot yet.
    const matches = [...groupMatchday(1, 3), ...groupMatchday(2, 0), ...groupMatchday(3, 0)]
    expect(completedMatchdays(matches)).toEqual([])
  })

  it('captures MD1 the moment its last result lands (the first snapshot)', () => {
    const matches = [...groupMatchday(1, 6), ...groupMatchday(2, 0), ...groupMatchday(3, 0)]
    expect(completedMatchdays(matches)).toEqual(['MD1'])
  })

  it('accumulates matchdays as they each complete, in x-axis order', () => {
    const matches = [...groupMatchday(1, 6), ...groupMatchday(2, 6), ...groupMatchday(3, 4)]
    expect(completedMatchdays(matches)).toEqual(['MD1', 'MD2'])
  })

  it('captures knockout rounds too (by round, not matchday)', () => {
    const matches: MatchState[] = [
      ...groupMatchday(1, 6),
      ...groupMatchday(2, 6),
      ...groupMatchday(3, 6),
      { round: 'r16', matchday: null, hasResult: true },
      { round: 'r16', matchday: null, hasResult: true },
      { round: 'qf', matchday: null, hasResult: false },
    ]
    expect(completedMatchdays(matches)).toEqual(['MD1', 'MD2', 'MD3', 'R16'])
  })

  it('ignores a round with no matches at all', () => {
    expect(completedMatchdays(groupMatchday(1, 6))).toEqual(['MD1'])
  })
})
