import { describe, expect, it } from 'vitest'
import { mapH2HRankHistory } from '../../src/services/supabase/h2hRankHistoryModel'

const md1 = {
  key: 'MD1',
  order: 1,
  rank: 4,
  total_points: 18,
  captured_at: '2028-06-15T20:00:00Z',
}

const md2 = {
  key: 'MD2',
  order: 2,
  rank: 2,
  total_points: 39,
  captured_at: '2028-06-20T20:00:00Z',
}

describe('mapH2HRankHistory', () => {
  it('maps bounded canonical checkpoints', () => {
    expect(mapH2HRankHistory({ you: [md1, md2], rival: [md1] })).toEqual({
      you: [
        { key: 'MD1', order: 1, rank: 4, totalPoints: 18, capturedAt: md1.captured_at },
        { key: 'MD2', order: 2, rank: 2, totalPoints: 39, capturedAt: md2.captured_at },
      ],
      rival: [
        { key: 'MD1', order: 1, rank: 4, totalPoints: 18, capturedAt: md1.captured_at },
      ],
    })
  })

  it('accepts an empty history before the first captured checkpoint', () => {
    expect(mapH2HRankHistory({ you: [], rival: [] })).toEqual({ you: [], rival: [] })
  })

  it('rejects more than seven rows', () => {
    expect(() =>
      mapH2HRankHistory({ you: Array.from({ length: 8 }, () => md1), rival: [] }),
    ).toThrow(/malformed/i)
  })

  it('rejects unknown, duplicated or out-of-order checkpoints', () => {
    expect(() =>
      mapH2HRankHistory({ you: [{ ...md1, key: 'MD4', order: 4 }], rival: [] }),
    ).toThrow(/malformed checkpoint/i)
    expect(() => mapH2HRankHistory({ you: [md1, md1], rival: [] })).toThrow(
      /malformed checkpoint/i,
    )
    expect(() => mapH2HRankHistory({ you: [md2, md1], rival: [] })).toThrow(
      /malformed checkpoint/i,
    )
  })

  it('rejects invalid ranks, points and timestamps', () => {
    expect(() => mapH2HRankHistory({ you: [{ ...md1, rank: 0 }], rival: [] })).toThrow()
    expect(() => mapH2HRankHistory({ you: [{ ...md1, total_points: -1 }], rival: [] })).toThrow()
    expect(() =>
      mapH2HRankHistory({ you: [{ ...md1, captured_at: 'not-a-date' }], rival: [] }),
    ).toThrow()
  })
})
