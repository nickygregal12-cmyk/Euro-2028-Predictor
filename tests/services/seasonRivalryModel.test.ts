import { describe, expect, it } from 'vitest'
import {
  mapSeasonRivalry,
  rivalryComparable,
  type SeasonRivalryReach,
} from '../../src/services/supabase/seasonRivalryModel'
import { at, first } from '../support/indexed'

/**
 * CONTRACT 192'S RIVALRY DECODER, TESTED WHERE A SEASON COMPARISON GOES WRONG.
 *
 * Not that fields are copied — the compiler covers that. These are the answers
 * that would be MISLEADING rather than merely different:
 *
 *   1. THE RECORD IS NOT THE `recent` WINDOW. `recent` is truncated by the
 *      server's bound; a record counted off it reports the last five
 *      matchweeks of a thirty-matchweek rivalry as the whole story.
 *   2. 0-0-0 OUT OF NOTHING IS NOT A DRAW. Before anything settles for both
 *      players there is no comparison, and nothing may divide by zero to say
 *      otherwise.
 *   3. A RANK NEVER TRAVELS WITHOUT ITS FIELD, and an unranked player is
 *      absent rather than zeroth.
 *   4. THE OUTCOME IS THE SERVER'S. A row missing it is dropped, never
 *      recomputed from the two point figures.
 *   5. `pointsGap` KEEPS ITS SIGN — positive means the opponent is ahead.
 *   6. `playerRef` and `playerId` are two identifiers and are never
 *      substituted for one another.
 */

function side(overrides: Record<string, unknown> = {}) {
  return {
    playerRef: 'entry-you',
    displayName: 'Rhona Buchanan',
    reach: 'self',
    playerId: 'user-you',
    points: 148,
    matchweeksPlayed: 12,
    rank: 4,
    fieldSize: 412,
    fixturesCompared: 96,
    exactScores: 11,
    correctOutcomes: 54,
    ...overrides,
  }
}

function matchweek(overrides: Record<string, unknown> = {}) {
  return {
    matchweekId: 'mw-12',
    ordinal: 12,
    label: 'Matchweek 12',
    yourPoints: 14,
    theirPoints: 9,
    outcome: 'you',
    ...overrides,
  }
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    server_now: '2027-11-14T19:20:00.000Z',
    matchweeksCompared: 12,
    you: side(),
    opponent: side({
      playerRef: 'entry-them',
      displayName: 'Callum Aitken',
      reach: 'compare',
      playerId: null,
      points: 161,
      rank: 2,
    }),
    pointsGap: 13,
    record: { yourWins: 5, theirWins: 6, draws: 1 },
    recent: [matchweek()],
    ...overrides,
  }
}

describe('the payload as a whole', () => {
  it('decodes an ordinary rivalry', () => {
    const rivalry = mapSeasonRivalry(payload())

    expect(rivalry.serverNow).toBe('2027-11-14T19:20:00.000Z')
    expect(rivalry.matchweeksCompared).toBe(12)
    expect(rivalry.you.displayName).toBe('Rhona Buchanan')
    expect(rivalry.opponent.displayName).toBe('Callum Aitken')
    expect(rivalry.record).toEqual({ yourWins: 5, theirWins: 6, draws: 1 })
    expect(rivalry.recent).toHaveLength(1)
  })

  it('refuses a payload missing either side', () => {
    expect(() => mapSeasonRivalry(payload({ you: null }))).toThrow()
    expect(() => mapSeasonRivalry(payload({ opponent: undefined }))).toThrow()
    expect(() => mapSeasonRivalry(null)).toThrow()
  })
})

describe('the record is not the recent window', () => {
  it('keeps a stated denominator larger than the window it truncated', () => {
    // Thirty matchweeks compared, five sent back. A surface counting the
    // record off `recent` would report 3-2 from a 14-13-3 rivalry.
    const rivalry = mapSeasonRivalry(
      payload({
        matchweeksCompared: 30,
        record: { yourWins: 14, theirWins: 13, draws: 3 },
        recent: [
          matchweek({ matchweekId: 'mw-30', ordinal: 30, outcome: 'you' }),
          matchweek({ matchweekId: 'mw-29', ordinal: 29, outcome: 'you' }),
          matchweek({ matchweekId: 'mw-28', ordinal: 28, outcome: 'them' }),
          matchweek({ matchweekId: 'mw-27', ordinal: 27, outcome: 'you' }),
          matchweek({ matchweekId: 'mw-26', ordinal: 26, outcome: 'them' }),
        ],
      }),
    )

    expect(rivalry.matchweeksCompared).toBe(30)
    expect(rivalry.recent).toHaveLength(5)
    const tallied =
      rivalry.record.yourWins + rivalry.record.theirWins + rivalry.record.draws
    expect(tallied).toBe(30)
    expect(tallied).not.toBe(rivalry.recent.length)
  })

  it('does not shrink the denominator when a window row is dropped', () => {
    // The arithmetic and the window are independent, which is the point of the
    // server stating both.
    const rivalry = mapSeasonRivalry(
      payload({
        matchweeksCompared: 12,
        recent: [matchweek(), matchweek({ ordinal: null })],
      }),
    )

    expect(rivalry.recent).toHaveLength(1)
    expect(rivalry.matchweeksCompared).toBe(12)
  })
})

describe('a zero denominator is an answer, not a draw', () => {
  const nothingYet = payload({
    matchweeksCompared: 0,
    record: { yourWins: 0, theirWins: 0, draws: 0 },
    recent: [],
    you: side({ points: 0, matchweeksPlayed: 0, fixturesCompared: 0, exactScores: 0, correctOutcomes: 0 }),
    opponent: side({
      playerRef: 'entry-them',
      displayName: 'Callum Aitken',
      reach: 'compare',
      playerId: null,
      points: 0,
      matchweeksPlayed: 0,
      fixturesCompared: 0,
      exactScores: 0,
      correctOutcomes: 0,
    }),
    pointsGap: 0,
  })

  it('reports the rivalry as not yet comparable', () => {
    expect(rivalryComparable(mapSeasonRivalry(nothingYet))).toBe(false)
  })

  it('separates it from a genuine one-all draw', () => {
    // Both read 0-0-0 in the record alone. Only the denominator tells them
    // apart, which is why a surface must ask rather than count.
    const drawn = mapSeasonRivalry(
      payload({ matchweeksCompared: 2, record: { yourWins: 0, theirWins: 0, draws: 2 } }),
    )

    expect(rivalryComparable(drawn)).toBe(true)
    expect(rivalryComparable(mapSeasonRivalry(nothingYet))).toBe(false)
  })

  it('leaves both accuracy denominators at zero rather than inventing one', () => {
    const rivalry = mapSeasonRivalry(nothingYet)
    expect(rivalry.you.accuracy.fixturesCompared).toBe(0)
    expect(rivalry.opponent.accuracy.fixturesCompared).toBe(0)
  })
})

describe('a rank never travels without its field', () => {
  it('keeps both where the player holds a standing', () => {
    const rivalry = mapSeasonRivalry(payload())
    expect(rivalry.you.standing).toEqual({ rank: 4, fieldSize: 412 })
  })

  it('reports no standing at all where the server sent neither', () => {
    // The RPC left-joins the standings: a player with nothing banked sends
    // both as null. Absent, not zeroth.
    const rivalry = mapSeasonRivalry(
      payload({ opponent: side({ playerRef: 'entry-them', reach: 'compare', playerId: null, rank: null, fieldSize: null }) }),
    )
    expect(rivalry.opponent.standing).toBeNull()
  })

  it('refuses a half-stated standing rather than patching it', () => {
    expect(mapSeasonRivalry(payload({ you: side({ fieldSize: null }) })).you.standing).toBeNull()
    expect(mapSeasonRivalry(payload({ you: side({ rank: undefined }) })).you.standing).toBeNull()
  })

  it('still carries the points a player scored without a standing', () => {
    // Losing the rank must not lose the season total beside it.
    const rivalry = mapSeasonRivalry(payload({ you: side({ rank: null, fieldSize: null, points: 148 }) }))
    expect(rivalry.you.standing).toBeNull()
    expect(rivalry.you.points).toBe(148)
  })
})

describe('the outcome is the server`s verdict', () => {
  for (const outcome of ['you', 'them', 'level'] as const) {
    it(`carries ${outcome} through`, () => {
      const rivalry = mapSeasonRivalry(payload({ recent: [matchweek({ outcome })] }))
      expect(first(rivalry.recent).outcome).toBe(outcome)
    })
  }

  it('drops a row with no outcome rather than deriving one from the points', () => {
    // 14 v 9 makes the answer look obvious, and that is exactly the temptation:
    // a second rule here agrees until the day the scoring changes underneath it.
    const rivalry = mapSeasonRivalry(
      payload({ recent: [matchweek({ yourPoints: 14, theirPoints: 9, outcome: null })] }),
    )
    expect(rivalry.recent).toEqual([])
  })

  it('drops an outcome it does not understand', () => {
    const rivalry = mapSeasonRivalry(payload({ recent: [matchweek({ outcome: 'shared' })] }))
    expect(rivalry.recent).toEqual([])
  })

  it('keeps a server verdict that disagrees with the point figures', () => {
    // Not this module's argument to have. If the server says the matchweek was
    // level, the surface shows level.
    const rivalry = mapSeasonRivalry(
      payload({ recent: [matchweek({ yourPoints: 14, theirPoints: 9, outcome: 'level' })] }),
    )
    expect(first(rivalry.recent).outcome).toBe('level')
  })
})

describe('a malformed window row is dropped, not patched', () => {
  const broken: readonly (readonly [string, Record<string, unknown>])[] = [
    ['no matchweek id', { matchweekId: null }],
    ['no label', { label: '' }],
    ['no points of yours', { yourPoints: null }],
    ['no points of theirs', { theirPoints: undefined }],
    ['a fractional points figure', { yourPoints: 7.5 }],
  ]

  for (const [what, overrides] of broken) {
    it(`drops a row with ${what}`, () => {
      expect(mapSeasonRivalry(payload({ recent: [matchweek(overrides)] })).recent).toEqual([])
    })
  }

  it('drops a row that is not an object at all', () => {
    expect(mapSeasonRivalry(payload({ recent: ['nonsense', 7] })).recent).toEqual([])
  })

  it('keeps the good rows beside the dropped one', () => {
    const rivalry = mapSeasonRivalry(
      payload({
        recent: [
          matchweek({ matchweekId: 'mw-12', ordinal: 12 }),
          matchweek({ matchweekId: 'mw-11', ordinal: 11, outcome: undefined }),
          matchweek({ matchweekId: 'mw-10', ordinal: 10 }),
        ],
      }),
    )
    expect(rivalry.recent.map((entry) => entry.matchweekId)).toEqual(['mw-12', 'mw-10'])
  })

  it('treats a missing window as empty rather than as a failure', () => {
    expect(mapSeasonRivalry(payload({ recent: undefined })).recent).toEqual([])
  })

  it('keeps a scoreless matchweek, which is a settled result', () => {
    const rivalry = mapSeasonRivalry(
      payload({ recent: [matchweek({ yourPoints: 0, theirPoints: 0, outcome: 'level' })] }),
    )
    expect(first(rivalry.recent).yourPoints).toBe(0)
  })
})

describe('the server`s order survives', () => {
  it('does not re-sort the window it was given', () => {
    const rivalry = mapSeasonRivalry(
      payload({
        recent: [
          matchweek({ matchweekId: 'mw-12', ordinal: 12 }),
          matchweek({ matchweekId: 'mw-11', ordinal: 11 }),
          matchweek({ matchweekId: 'mw-9', ordinal: 9 }),
        ],
      }),
    )
    expect(rivalry.recent.map((entry) => entry.ordinal)).toEqual([12, 11, 9])
    expect(at(rivalry.recent, 0).matchweekId).toBe('mw-12')
  })
})

describe('the gap keeps the sign the server gave it', () => {
  it('reads positive when the opponent is ahead', () => {
    expect(mapSeasonRivalry(payload({ pointsGap: 13 })).pointsGap).toBe(13)
  })

  it('reads negative when the caller is ahead', () => {
    expect(mapSeasonRivalry(payload({ pointsGap: -13 })).pointsGap).toBe(-13)
  })

  it('agrees with the two point totals rather than replacing them', () => {
    const rivalry = mapSeasonRivalry(
      payload({
        you: side({ points: 148 }),
        opponent: side({ playerRef: 'entry-them', reach: 'compare', playerId: null, points: 161 }),
        pointsGap: 13,
      }),
    )
    expect(rivalry.opponent.points - rivalry.you.points).toBe(rivalry.pointsGap)
  })
})

describe('reach is the server`s answer', () => {
  for (const reach of ['self', 'profile', 'compare', 'name-only'] as SeasonRivalryReach[]) {
    it(`carries ${reach} through on the opponent`, () => {
      const rivalry = mapSeasonRivalry(
        payload({ opponent: side({ playerRef: 'entry-them', reach, playerId: null }) }),
      )
      expect(rivalry.opponent.reach).toBe(reach)
    })
  }

  it('refuses a reach it does not understand rather than downgrading it', () => {
    expect(() =>
      mapSeasonRivalry(payload({ opponent: side({ playerRef: 'entry-them', reach: 'acquaintance' }) })),
    ).toThrow()
  })

  it('refuses a side with no reference or no name', () => {
    expect(() => mapSeasonRivalry(payload({ opponent: side({ playerRef: null }) }))).toThrow()
    expect(() => mapSeasonRivalry(payload({ opponent: side({ displayName: '' }) }))).toThrow()
  })
})

describe('the two identifiers stay two identifiers', () => {
  it('carries an account id only where the server sent one', () => {
    const hidden = mapSeasonRivalry(
      payload({ opponent: side({ playerRef: 'entry-them', reach: 'compare', playerId: null }) }),
    )
    const open = mapSeasonRivalry(
      payload({ opponent: side({ playerRef: 'entry-them', reach: 'profile', playerId: 'user-them' }) }),
    )

    expect(hidden.opponent.playerId).toBeNull()
    expect(open.opponent.playerId).toBe('user-them')
  })

  it('never substitutes the entry reference for the account id', () => {
    const rivalry = mapSeasonRivalry(
      payload({ opponent: side({ playerRef: 'entry-them', reach: 'compare', playerId: null }) }),
    )
    expect(rivalry.opponent.playerRef).toBe('entry-them')
    expect(rivalry.opponent.playerId).not.toBe('entry-them')
  })

  it('keeps two identically named players apart by their references', () => {
    // The whole reason Stage 10 may not address a player by name.
    const rivalry = mapSeasonRivalry(
      payload({
        you: side({ playerRef: 'entry-a', displayName: 'Alex Morgan' }),
        opponent: side({ playerRef: 'entry-b', displayName: 'Alex Morgan', reach: 'compare', playerId: null }),
      }),
    )
    expect(rivalry.you.displayName).toBe(rivalry.opponent.displayName)
    expect(rivalry.you.playerRef).not.toBe(rivalry.opponent.playerRef)
  })
})

describe('the payload carries no prediction', () => {
  it('states accuracy as counts and nothing else', () => {
    const rivalry = mapSeasonRivalry(payload())
    expect(Object.keys(rivalry.you.accuracy).sort()).toEqual([
      'correctOutcomes',
      'exactScores',
      'fixturesCompared',
    ])
  })

  it('ignores an unexpected prediction-shaped field rather than carrying it', () => {
    const rivalry = mapSeasonRivalry(
      payload({
        recent: [{ ...matchweek(), predictions: { 'fx-1': { home: 2, away: 1 } } }],
        you: { ...side(), predictions: { 'fx-1': { home: 2, away: 1 } } },
      }),
    )
    expect(JSON.stringify(rivalry)).not.toContain('predictions')
  })

  it('carries two different denominators when the server sends two', () => {
    // THE RULE IS SHARED, THE DENOMINATOR IS NOT. `count(*) … group by
    // prediction.entry_id` counts each entry's own prediction rows, so a player
    // who skipped fixtures inside a compared matchweek has fewer. A decoder
    // that normalised them — or a test asserting they match — would make the
    // two columns look comparable when they are not.
    //
    // The earlier version of this test read the same default off both sides and
    // could not fail for any implementation that copied the field.
    const rivalry = mapSeasonRivalry(
      payload({
        you: side({ fixturesCompared: 96, exactScores: 11 }),
        opponent: side({
          playerRef: 'entry-them',
          reach: 'compare',
          playerId: null,
          fixturesCompared: 60,
          exactScores: 11,
        }),
      }),
    )

    expect(rivalry.you.accuracy.fixturesCompared).toBe(96)
    expect(rivalry.opponent.accuracy.fixturesCompared).toBe(60)
    // Same numerator, same rate, different facts — which is the whole reason a
    // surface must print the denominator.
    expect(rivalry.you.accuracy.exactScores).toBe(rivalry.opponent.accuracy.exactScores)
  })
})
