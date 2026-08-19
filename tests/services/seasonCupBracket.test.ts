import { describe, expect, it } from 'vitest'
import { mapSeasonCupBracket } from '../../src/services/supabase/seasonCupBracketModel'

/**
 * CONTRACT 193'S FIRST DECODER, TESTED WHERE THE PAYLOAD IS SURPRISING.
 *
 * The compiler covers field copying. These are the answers that would be WRONG
 * rather than merely different, and every one of them comes from reading the
 * migration's own `jsonb_build_object` calls rather than from assuming what a
 * bracket carries.
 */

function payload(overrides: Record<string, unknown> = {}) {
  return {
    competition_id: 'comp-1',
    entered: true,
    server_now: '2027-05-01T12:00:00.000Z',
    format: { kind: 'groups', produces_knockout: true, group_stage_last_sequence: 20 },
    qualification: { drawn: true, qualifiers: 4, your_seed: 2, you_qualified: true },
    my_tie: null,
    penalty_number: null,
    my_ties: [],
    bracket: [],
    champion: null,
    ...overrides,
  }
}

function seat(overrides: Record<string, unknown> = {}) {
  return {
    fixture_id: 'fx-1',
    stage: 'knockout',
    round_size: 4,
    bracket_slot: 1,
    window_sequence: 21,
    window_label: 'Semi-finals',
    home: { user_id: 'u-1', display_name: 'Ada' },
    away: { user_id: 'u-2', display_name: 'Bo' },
    is_yours: true,
    winner_user_id: null,
    decided_by: null,
    ...overrides,
  }
}

describe('a non-entrant learns nothing', () => {
  it('reads as not entered, and carries no other field', () => {
    expect(mapSeasonCupBracket({ competition_id: 'comp-1', entered: false })).toEqual({
      entered: false,
    })
  })

  it('treats an unknown id the same way', () => {
    // Contract 133's boundary: a private UUID is not an existence oracle, and
    // the read returns byte-identical output for both cases.
    expect(mapSeasonCupBracket({ competition_id: 'nope', entered: false })).toEqual({
      entered: false,
    })
  })
})

/**
 * THE TRAP THAT WOULD SHOW A PERSON CALLED "PLAYER" IN EVERY HOLE.
 *
 * Contract 193 renders every side as `coalesce(profile.display_name,
 * 'Player')`, so an unfilled seat and a real player with no profile row are
 * textually identical. Only `user_id` separates them.
 */
describe('an empty seat is not a person called Player', () => {
  it('reads a seat with no user id as empty', () => {
    const model = mapSeasonCupBracket(
      payload({ bracket: [seat({ away: { user_id: null, display_name: 'Player' } })] }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.bracket[0]?.away).toBeNull()
    expect(model.bracket[0]?.home).toEqual({ userId: 'u-1', displayName: 'Ada' })
  })

  it('keeps a real player whose profile row is missing', () => {
    // Same display name, but a user id — so this is a person, not a hole.
    const model = mapSeasonCupBracket(
      payload({ bracket: [seat({ away: { user_id: 'u-9', display_name: 'Player' } })] }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.bracket[0]?.away).toEqual({ userId: 'u-9', displayName: 'Player' })
  })

  it('handles both opponent encodings, which differ between the two keys', () => {
    // `my_tie.opponent` is a scalar subselect and arrives as null outright;
    // `my_ties[].opponent` is a built object and arrives with a null id.
    const model = mapSeasonCupBracket(
      payload({
        my_tie: { ...seat(), is_home: true, opponent: null, locks_at: null },
        my_ties: [{ ...seat(), opponent: { user_id: null, display_name: 'Player' }, settled: false }],
      }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.myTie?.opponent).toBeNull()
    expect(model.myTies[0]?.opponent).toBeNull()
  })
})

/**
 * THE `stage` WORKAROUND. Contract 193 uses `stage <> 'group'` in four places,
 * which sweeps in `split` fixtures — contract 102's whole point, and a
 * predicate contract 194 asserts against. A split fixture can never settle, so
 * `my_tie`'s `winner_user_id is null` filter does not exclude it.
 */
describe('a split fixture is never rendered as a knockout tie', () => {
  it('drops a split seat from the bracket', () => {
    const model = mapSeasonCupBracket(
      payload({
        bracket: [
          seat({ fixture_id: 'fx-split', stage: 'split', round_size: null, bracket_slot: null }),
          seat({ fixture_id: 'fx-ko' }),
        ],
      }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.bracket.map((s) => s.fixtureId)).toEqual(['fx-ko'])
  })

  it('drops a split fixture offered as the live tie', () => {
    const model = mapSeasonCupBracket(
      payload({
        my_tie: { ...seat({ stage: 'split', round_size: null, bracket_slot: null }), is_home: true, opponent: null, locks_at: null },
      }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.myTie).toBeNull()
  })

  it('drops the Penalty Number that came with it, for a fixture that has none', () => {
    const model = mapSeasonCupBracket(
      payload({
        my_tie: { ...seat({ stage: 'split' }), is_home: true, opponent: null, locks_at: null },
        penalty_number: {
          window_id: 'w-1', window_label: 'R', lane: 'odd',
          submitted: false, value: null, version: null,
          locks_at: null, locked: false, open: false,
        },
      }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.penaltyNumber).toBeNull()
  })

  it('keeps a playoff, which is a real knockout-side stage', () => {
    const model = mapSeasonCupBracket(
      payload({ bracket: [seat({ stage: 'playoff', round_size: null })] }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.bracket[0]?.stage).toBe('playoff')
  })
})

describe('the Penalty Number boundary is carried, not recomputed', () => {
  const pn = (over: Record<string, unknown> = {}) =>
    payload({
      my_tie: { ...seat(), is_home: true, opponent: null, locks_at: null },
      penalty_number: {
        window_id: 'w-1', window_label: 'Semi-finals', lane: 'odd',
        submitted: true, value: 0, version: 3,
        locks_at: '2027-05-02T14:00:00.000Z', locked: false, open: true,
        ...over,
      },
    })

  it('carries both booleans, because they are not complements', () => {
    // Unscheduled fixtures: `cup_window_first_kickoff` is null, so the server
    // returns BOTH false. A surface reading one as the negation of the other
    // would call an unscheduled round open.
    const model = mapSeasonCupBracket(pn({ locked: false, open: false, locks_at: null }))
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.penaltyNumber?.locked).toBe(false)
    expect(model.penaltyNumber?.open).toBe(false)
  })

  it('keeps a submitted value of zero, which is a legal Penalty Number', () => {
    const model = mapSeasonCupBracket(pn())
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.penaltyNumber?.value).toBe(0)
    expect(model.penaltyNumber?.submitted).toBe(true)
  })

  it('keeps an unsubmitted value null rather than defaulting it', () => {
    const model = mapSeasonCupBracket(pn({ submitted: false, value: null }))
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.penaltyNumber?.value).toBeNull()
  })
})

describe('the settlement vocabulary is read, never re-derived', () => {
  it('carries every decision the server can state', () => {
    for (const decided of ['points', 'extra_time', 'penalty_number', 'walkover', 'admin_walkover']) {
      const model = mapSeasonCupBracket(
        payload({ bracket: [seat({ decided_by: decided, winner_user_id: 'u-1' })] }),
      )
      if (!model.entered) throw new Error('expected an entrant')
      expect(model.bracket[0]?.decidedBy).toBe(decided)
    }
  })

  it('refuses a decision it does not know rather than passing it through', () => {
    const model = mapSeasonCupBracket(payload({ bracket: [seat({ decided_by: 'coin_toss' })] }))
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.bracket[0]?.decidedBy).toBeNull()
  })
})

describe('the order is the server’s', () => {
  it('keeps the payload order, including across a dropped split fixture', () => {
    const model = mapSeasonCupBracket(
      payload({
        bracket: [
          seat({ fixture_id: 'a', window_sequence: 21, bracket_slot: 1 }),
          seat({ fixture_id: 'split', stage: 'split' }),
          seat({ fixture_id: 'b', window_sequence: 21, bracket_slot: 2 }),
          seat({ fixture_id: 'c', window_sequence: 22, bracket_slot: 1 }),
        ],
      }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.bracket.map((s) => s.fixtureId)).toEqual(['a', 'b', 'c'])
  })
})

describe('the seed is an answer or an absence, never a zero', () => {
  it('keeps a missing seed null', () => {
    const model = mapSeasonCupBracket(
      payload({ qualification: { drawn: false, qualifiers: 0, your_seed: null, you_qualified: false } }),
    )
    if (!model.entered) throw new Error('expected an entrant')
    expect(model.qualification.yourSeed).toBeNull()
    expect(model.qualification.qualifiers).toBe(0)
  })
})

/**
 * THE FIELDS THAT WERE DECODED AND ASSERTED NOWHERE.
 *
 * A mutation setting `server_now` to a literal, negating `produces_knockout`
 * and replacing `group_stage_last_sequence` with 4242 passed 148 tests. A field
 * carried through a decoder with nothing checking it is a field the decoder is
 * free to get wrong.
 */
describe('the clock and the format are carried as sent', () => {
  it('carries the DATABASE’s own instant, not one this process made', () => {
    const read = mapSeasonCupBracket(payload({ server_now: '2027-06-09T09:30:00.000Z' }))
    if (!read.entered) throw new Error('expected an entrant')
    expect(read.serverNow).toBe('2027-06-09T09:30:00.000Z')
  })

  it('carries the launch record’s format, unaltered', () => {
    const read = mapSeasonCupBracket(
      payload({
        format: { kind: 'single_group', produces_knockout: false, group_stage_last_sequence: 38 },
      }),
    )
    if (!read.entered) throw new Error('expected an entrant')
    expect(read.format).toEqual({
      kind: 'single_group',
      producesKnockout: false,
      groupStageLastSequence: 38,
    })
  })
})

/**
 * THE `my_ties` STAGE FILTER. One of the four the module header names, and the
 * one no test covered: replacing its rejection with a default to `'knockout'`
 * passed every test in this file.
 */
describe('my_ties drops a split fixture rather than calling it a knockout', () => {
  function tie(overrides: Record<string, unknown> = {}) {
    return {
      fixture_id: 'mt-1',
      stage: 'knockout',
      window_sequence: 21,
      window_label: 'Semi-finals',
      is_home: true,
      opponent: { user_id: 'u-2', display_name: 'Bo' },
      settled: true,
      you_won: true,
      decided_by: 'points',
      settled_at: '2027-05-02T18:00:00.000Z',
      ...overrides,
    }
  }

  it('keeps knockout and playoff ties', () => {
    const read = mapSeasonCupBracket(
      payload({ my_ties: [tie(), tie({ fixture_id: 'mt-2', stage: 'playoff' })] }),
    )
    if (!read.entered) throw new Error('expected an entrant')
    expect(read.myTies.map((t) => t.stage)).toEqual(['knockout', 'playoff'])
  })

  it.each(['split', 'group', 'league', null, undefined, 42])(
    'drops a tie whose stage is %s rather than defaulting it',
    (stage) => {
      const read = mapSeasonCupBracket(payload({ my_ties: [tie({ stage })] }))
      if (!read.entered) throw new Error('expected an entrant')
      expect(read.myTies).toEqual([])
    },
  )

  it('carries `is_home`, which is how the surface knows which side is the caller', () => {
    const read = mapSeasonCupBracket(
      payload({ my_ties: [tie({ is_home: false }), tie({ fixture_id: 'mt-2', is_home: true })] }),
    )
    if (!read.entered) throw new Error('expected an entrant')
    expect(read.myTies.map((t) => t.isHome)).toEqual([false, true])
  })

  it('treats a missing `is_home` as false rather than as true', () => {
    const read = mapSeasonCupBracket(payload({ my_ties: [tie({ is_home: undefined })] }))
    if (!read.entered) throw new Error('expected an entrant')
    expect(read.myTies[0]?.isHome).toBe(false)
  })
})
