import { describe, expect, it } from 'vitest'
import {
  mapSeasonRankHistory,
  type SeasonRankHistoryReach,
} from '../../src/services/supabase/seasonRankHistoryModel'
import { at, first } from '../support/indexed'

/**
 * CONTRACT 192'S DECODER, TESTED WHERE A HAND-WRITTEN JSONB PARSER GOES WRONG.
 *
 * Not that fields are copied — the compiler covers that. These are the answers
 * that would be WRONG rather than merely different:
 *
 *   0. `points` IS A RUNNING TOTAL AND IS DECODED AS `cumulativePoints`. The
 *      RPC computes it as a window sum over every settled matchweek so far, and
 *      contract 151's history carries the OTHER figure — that round's own score.
 *      A page drawing both, which the Stage 10 profile does, would print two
 *      different numbers for one matchweek if these were confused.
 *   1. RANK IS NEVER SEPARATED FROM ITS FIELD. 4th of six and 4th of six
 *      thousand are different facts, and a point carrying only one of them is
 *      not plottable.
 *   2. A MALFORMED POINT IS DROPPED, NOT PATCHED. A gap in a line is visible;
 *      a fabricated point is not.
 *   3. AN UNKNOWN `reach` IS A DECODE FAILURE, not a downgrade to the weakest
 *      one — this read's entire boundary is that answer.
 *   4. The server's ORDER survives, because the RPC already ordered by ordinal.
 *   5. `playerRef` and `playerId` are two different identifiers and are never
 *      substituted for one another.
 */

type Point = {
  matchweekId?: unknown
  ordinal?: unknown
  label?: unknown
  points?: unknown
  rank?: unknown
  fieldSize?: unknown
}

function point(overrides: Point = {}) {
  return {
    matchweekId: 'mw-1',
    ordinal: 1,
    label: 'Matchweek 1',
    points: 112,
    rank: 4,
    fieldSize: 412,
    ...overrides,
  }
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    playerRef: 'entry-1',
    reach: 'compare',
    displayName: 'Rhona Buchanan',
    playerId: null,
    server_now: '2027-11-14T19:20:00.000Z',
    matchweeks: [point()],
    ...overrides,
  }
}

describe('the payload as a whole', () => {
  it('decodes an ordinary history', () => {
    const history = mapSeasonRankHistory(payload())

    expect(history.playerRef).toBe('entry-1')
    expect(history.reach).toBe('compare')
    expect(history.displayName).toBe('Rhona Buchanan')
    expect(history.playerId).toBeNull()
    expect(history.serverNow).toBe('2027-11-14T19:20:00.000Z')
    expect(history.matchweeks).toHaveLength(1)
  })

  it('accepts an empty series, which is a season before its first settlement', () => {
    expect(mapSeasonRankHistory(payload({ matchweeks: [] })).matchweeks).toEqual([])
  })

  it('treats a missing series as empty rather than as a failure', () => {
    const history = mapSeasonRankHistory(payload({ matchweeks: undefined }))
    expect(history.matchweeks).toEqual([])
  })

  it('refuses a payload with no reference, name or reach', () => {
    expect(() => mapSeasonRankHistory(payload({ playerRef: null }))).toThrow()
    expect(() => mapSeasonRankHistory(payload({ displayName: null }))).toThrow()
    expect(() => mapSeasonRankHistory(payload({ reach: undefined }))).toThrow()
    expect(() => mapSeasonRankHistory(null)).toThrow()
  })
})

describe('reach is the server`s answer', () => {
  for (const reach of ['self', 'profile', 'compare', 'name-only'] as SeasonRankHistoryReach[]) {
    it(`carries ${reach} through`, () => {
      expect(mapSeasonRankHistory(payload({ reach })).reach).toBe(reach)
    })
  }

  it('refuses a reach it does not understand rather than downgrading it', () => {
    // A payload from a contract this build does not know. Treating it as the
    // weakest reach would render a player less reachable than the server said,
    // and this read's whole boundary is that answer.
    expect(() => mapSeasonRankHistory(payload({ reach: 'acquaintance' }))).toThrow()
  })
})

describe('the two identifiers stay two identifiers', () => {
  it('carries an account id only where the server sent one', () => {
    expect(mapSeasonRankHistory(payload({ reach: 'compare', playerId: null })).playerId).toBeNull()
    expect(
      mapSeasonRankHistory(payload({ reach: 'profile', playerId: 'user-9' })).playerId,
    ).toBe('user-9')
  })

  it('never substitutes the entry reference for the account id', () => {
    const history = mapSeasonRankHistory(payload({ playerRef: 'entry-1', playerId: null }))
    expect(history.playerRef).toBe('entry-1')
    expect(history.playerId).not.toBe('entry-1')
  })
})

describe('a rank never travels without its field', () => {
  it('keeps both on every point', () => {
    const history = mapSeasonRankHistory(payload({ matchweeks: [point({ rank: 4, fieldSize: 412 })] }))
    const only = first(history.matchweeks)
    expect(only.rank).toBe(4)
    expect(only.fieldSize).toBe(412)
  })

  it('drops a point that states a rank with no field', () => {
    // Unplottable: 4th means nothing without what it is 4th of. Dropping it
    // leaves a visible gap; defaulting the field would invent the fact.
    const history = mapSeasonRankHistory(payload({ matchweeks: [point({ fieldSize: null })] }))
    expect(history.matchweeks).toEqual([])
  })

  it('drops a point that states a field with no rank', () => {
    const history = mapSeasonRankHistory(payload({ matchweeks: [point({ rank: undefined })] }))
    expect(history.matchweeks).toEqual([])
  })
})

describe('a malformed point is dropped, not patched', () => {
  const broken: readonly (readonly [string, Point])[] = [
    ['no matchweek id', { matchweekId: null }],
    ['no ordinal', { ordinal: null }],
    ['no label', { label: '' }],
    ['no points', { points: null }],
    ['a fractional rank', { rank: 4.5 }],
    ['a fractional points figure', { points: 12.5 }],
  ]

  for (const [what, overrides] of broken) {
    it(`drops a point with ${what}`, () => {
      const history = mapSeasonRankHistory(payload({ matchweeks: [point(overrides)] }))
      expect(history.matchweeks).toEqual([])
    })
  }

  it('drops a row that is not an object at all', () => {
    expect(mapSeasonRankHistory(payload({ matchweeks: ['nonsense', 7] })).matchweeks).toEqual([])
  })

  it('keeps the good points beside the dropped one', () => {
    // The important half: one bad matchweek must not cost the whole series.
    const history = mapSeasonRankHistory(
      payload({
        matchweeks: [
          point({ matchweekId: 'mw-1', ordinal: 1 }),
          point({ matchweekId: 'mw-2', ordinal: 2, rank: null }),
          point({ matchweekId: 'mw-3', ordinal: 3 }),
        ],
      }),
    )

    expect(history.matchweeks.map((entry) => entry.matchweekId)).toEqual(['mw-1', 'mw-3'])
  })

  it('keeps a zero total, which is a real early-season standing', () => {
    // Nothing banked yet is an ordinary settled state, not a gap.
    const history = mapSeasonRankHistory(payload({ matchweeks: [point({ points: 0 })] }))
    expect(first(history.matchweeks).cumulativePoints).toBe(0)
  })

  it('decodes the running total under the name the SQL earns', () => {
    // `sum(...) over (... rows between unbounded preceding and current row)`.
    // Naming it `points` invited reading it as this matchweek's score, which is
    // the figure contract 151 carries and this read does not.
    const history = mapSeasonRankHistory(
      payload({
        matchweeks: [
          point({ matchweekId: 'mw-1', ordinal: 1, points: 12 }),
          point({ matchweekId: 'mw-2', ordinal: 2, points: 21 }),
          point({ matchweekId: 'mw-3', ordinal: 3, points: 36 }),
        ],
      }),
    )
    expect(history.matchweeks.map((entry) => entry.cumulativePoints)).toEqual([12, 21, 36])
  })
})

describe('the server`s order survives', () => {
  it('does not re-sort the series it was given', () => {
    // The RPC orders by ordinal and caps at 60. Re-sorting here would be a
    // second ordering authority that agrees until the day it does not.
    const history = mapSeasonRankHistory(
      payload({
        matchweeks: [
          point({ matchweekId: 'mw-3', ordinal: 3 }),
          point({ matchweekId: 'mw-1', ordinal: 1 }),
          point({ matchweekId: 'mw-2', ordinal: 2 }),
        ],
      }),
    )

    expect(history.matchweeks.map((entry) => entry.ordinal)).toEqual([3, 1, 2])
    expect(at(history.matchweeks, 0).matchweekId).toBe('mw-3')
  })
})

describe('the payload carries no prediction', () => {
  it('exposes only a matchweek, a total and a position', () => {
    // The RPC's own justification for needing only `compare` reach is that no
    // prediction appears in the payload. If a field ever arrives that could
    // carry one, this decoder must not silently pass it through.
    const history = mapSeasonRankHistory(payload())
    expect(Object.keys(first(history.matchweeks)).sort()).toEqual([
      'cumulativePoints',
      'fieldSize',
      'label',
      'matchweekId',
      'ordinal',
      'rank',
    ])
  })

  it('ignores an unexpected prediction-shaped field rather than carrying it', () => {
    const history = mapSeasonRankHistory(
      payload({ matchweeks: [{ ...point(), predictions: { 'fx-1': { home: 2, away: 1 } } }] }),
    )
    expect(JSON.stringify(history)).not.toContain('predictions')
  })
})
