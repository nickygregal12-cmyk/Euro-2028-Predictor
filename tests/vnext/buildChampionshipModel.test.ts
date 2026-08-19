import { describe, expect, it } from 'vitest'
import { buildChampionshipModel } from '../../src/vnext/integration/championship/buildChampionshipModel'
import type { ChampionshipSource } from '../../src/vnext/integration/championship/championshipSource'
import type { SeasonCupBracket } from '../../src/services/supabase/seasonCupBracketModel'
import { bracketRounds } from '../../src/vnext/models/championship'

/**
 * `ChampionshipSource` → `ChampionshipPageModel`, TESTED WHERE THE PREDICATE
 * BITES.
 *
 * The compiler covers field copying. These are the answers that would be WRONG:
 *
 *   1. THE BRACKET IS NOT RECONSTRUCTED. No pairing, no round arithmetic, no
 *      sorting — the stage's headline predicate, and the thing this file would
 *      be doing if anything were.
 *   2. ELIMINATION IS NEVER DERIVED. No season read supplies it, so the model
 *      says nothing rather than inferring it from a lost tie.
 *   3. A DETERMINISTIC OUTCOME GROWS NO FOOTBALL. A walkover carries a
 *      decision and no numbers, and no reason it was not given.
 *   4. AN EMPTY SEAT IS A HOLE, not a person called "Player".
 */

const NOW = '2027-05-01T12:00:00.000Z'

function seat(over: Record<string, unknown> = {}) {
  return {
    fixtureId: 'fx-1',
    stage: 'knockout' as const,
    roundSize: 4,
    bracketSlot: 1,
    windowSequence: 21,
    windowLabel: 'Semi-finals',
    home: { userId: 'u-me', displayName: 'Ada' },
    away: { userId: 'u-2', displayName: 'Bo' },
    isYours: true,
    winnerUserId: null,
    decidedBy: null,
    ...over,
  }
}

function entered(over: Partial<Extract<SeasonCupBracket, { entered: true }>> = {}) {
  return {
    entered: true as const,
    serverNow: NOW,
    format: { kind: 'groups', producesKnockout: true, groupStageLastSequence: 20 },
    qualification: { drawn: true, qualifiers: 4, yourSeed: 2, youQualified: true },
    myTie: {
      fixtureId: 'fx-1',
      stage: 'knockout' as const,
      roundSize: 4,
      bracketSlot: 1,
      windowSequence: 21,
      windowLabel: 'Semi-finals',
      isHome: true,
      opponent: { userId: 'u-2', displayName: 'Bo' },
      locksAt: null,
    },
    penaltyNumber: null,
    myTies: [],
    bracket: [seat()],
    champion: null,
    ...over,
  }
}

function source(bracket: SeasonCupBracket | null): ChampionshipSource {
  return {
    generatedAt: NOW,
    context: {
      tournamentId: 't-1',
      competitionId: 'c-1',
      competitionName: 'Caledonian Premiership',
      seasonLabel: '2027/28',
      gameName: 'Predictor Championship',
    },
    bracket: bracket === null ? { kind: 'failed' } : { kind: 'ok', bracket },
  }
}

describe('the bracket is carried, never rebuilt', () => {
  it('keeps the server’s order across rounds', () => {
    const model = buildChampionshipModel(
      source(
        entered({
          bracket: [
            seat({ fixtureId: 'a', windowSequence: 21, bracketSlot: 1 }),
            seat({ fixtureId: 'b', windowSequence: 21, bracketSlot: 2, isYours: false }),
            seat({ fixtureId: 'c', windowSequence: 22, bracketSlot: 1, isYours: false }),
          ],
        }),
      ),
    )
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    expect(model.bracket.seats.map((s) => s.key)).toEqual(['a', 'b', 'c'])
  })

  it('groups rounds on the server’s own key rather than by counting seats', () => {
    const model = buildChampionshipModel(
      source(
        entered({
          bracket: [
            seat({ fixtureId: 'a', windowSequence: 21, bracketSlot: 1 }),
            seat({ fixtureId: 'b', windowSequence: 21, bracketSlot: 2, isYours: false }),
            seat({ fixtureId: 'c', windowSequence: 22, bracketSlot: 1, isYours: false }),
          ],
        }),
      ),
    )
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    const rounds = bracketRounds(model.bracket.seats)
    expect(rounds.map((r) => r.windowSequence)).toEqual([21, 22])
    expect(rounds.map((r) => r.seats.length)).toEqual([2, 1])
  })

  it('carries a playoff seat whose round size the server left null', () => {
    // A playoff is not a knockout round and has no `round_size`. A mapper that
    // needed one to place a seat would have to invent it.
    const model = buildChampionshipModel(
      source(entered({ bracket: [seat({ stage: 'playoff', roundSize: null, bracketSlot: null })] })),
    )
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    expect(model.bracket.seats[0]?.roundSize).toBeNull()
    expect(model.bracket.seats[0]?.bracketSlot).toBeNull()
  })

  it('reports a drawn-but-empty bracket as not drawn rather than as an empty one', () => {
    const model = buildChampionshipModel(source(entered({ bracket: [] })))
    expect(model.bracket).toEqual({ kind: 'not-drawn' })
  })

  it('trusts the server’s `drawn` rather than the array being non-empty', () => {
    const model = buildChampionshipModel(
      source(entered({ qualification: { drawn: false, qualifiers: 0, yourSeed: null, youQualified: false } })),
    )
    expect(model.bracket).toEqual({ kind: 'not-drawn' })
  })
})

describe('an empty seat is a hole, not a person', () => {
  it('renders a missing side as empty', () => {
    const model = buildChampionshipModel(source(entered({ bracket: [seat({ away: null })] })))
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    expect(model.bracket.seats[0]?.away).toEqual({ kind: 'empty' })
  })

  it('does not infer a bye from it', () => {
    // A one-sided seat is a one-sided seat. WHY it is one-sided — a bye, a
    // withdrawal, a draw not yet made — is not in this payload.
    const model = buildChampionshipModel(source(entered({ bracket: [seat({ away: null })] })))
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    expect(model.bracket.seats[0]?.outcome).toEqual({ kind: 'unsettled' })
  })
})

describe('a deterministic outcome grows no football', () => {
  it('carries a walkover as a decision with no numbers', () => {
    const model = buildChampionshipModel(
      source(entered({ bracket: [seat({ winnerUserId: 'u-me', decidedBy: 'walkover' })] })),
    )
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    const outcome = model.bracket.seats[0]?.outcome
    expect(outcome).toEqual({
      kind: 'settled',
      decision: 'walkover',
      winnerIsHome: true,
      settledAt: null,
    })
    // There is nowhere in the type to put a score, and nothing invented one.
    expect(JSON.stringify(outcome)).not.toMatch(/score|points/i)
  })

  it('says nothing about WHY a walkover happened', () => {
    // `game_memberships.status` — withdrawn or disqualified — is not in this
    // read, so the model must have no field carrying a reason.
    const model = buildChampionshipModel(
      source(entered({ bracket: [seat({ winnerUserId: 'u-me', decidedBy: 'admin_walkover' })] })),
    )
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    expect(JSON.stringify(model.bracket.seats[0])).not.toMatch(/withdraw|disqualif/i)
  })

  it('leaves a tie unsettled when the server named no decision', () => {
    const model = buildChampionshipModel(
      source(entered({ bracket: [seat({ winnerUserId: 'u-me', decidedBy: null })] })),
    )
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    expect(model.bracket.seats[0]?.outcome).toEqual({ kind: 'unsettled' })
  })

  it('leaves `winnerIsHome` null when the winner is neither named side', () => {
    const model = buildChampionshipModel(
      source(entered({ bracket: [seat({ winnerUserId: 'u-someone-else', decidedBy: 'points' })] })),
    )
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    const outcome = model.bracket.seats[0]?.outcome
    expect(outcome?.kind === 'settled' && outcome.winnerIsHome).toBeNull()
  })
})

/**
 * THE STAGE'S OWN ANTI-DERIVATION RULE, and the one the user's decision pins.
 */
describe('elimination is never derived', () => {
  it('says nothing when a player lost their only tie', () => {
    const model = buildChampionshipModel(
      source(
        entered({
          qualification: { drawn: true, qualifiers: 4, yourSeed: 2, youQualified: false },
          bracket: [seat({ winnerUserId: 'u-2', decidedBy: 'points' })],
          myTies: [
            {
              fixtureId: 'fx-1',
              stage: 'knockout',
              windowSequence: 21,
              windowLabel: 'Semi-finals',
              opponent: { userId: 'u-2', displayName: 'Bo' },
              settled: true,
              youWon: false,
              decidedBy: 'points',
              settledAt: '2027-05-02T18:00:00.000Z',
            },
          ],
          myTie: null,
        }),
      ),
    )
    // A settled tie they did not win, with no later tie. The inference is
    // available and is refused: a player can lose in a competition that has not
    // finished eliminating, and no season read states the fact either way.
    expect(model.standing).toEqual({ kind: 'not-stated' })
  })

  it('states champion where the server named one', () => {
    const model = buildChampionshipModel(
      source(entered({ champion: { userId: 'u-me', displayName: 'Ada' } })),
    )
    expect(model.standing).toEqual({ kind: 'stated', outcome: 'champion' })
  })

  it('does not call the caller champion when somebody else won', () => {
    const model = buildChampionshipModel(
      source(entered({ champion: { userId: 'u-2', displayName: 'Bo' } })),
    )
    // They qualified, which the server did say. They are not the champion.
    expect(model.standing).toEqual({ kind: 'stated', outcome: 'qualified' })
  })

  it('never produces `eliminated`, because no read supplies it', () => {
    const worlds = [
      entered({ qualification: { drawn: true, qualifiers: 4, yourSeed: null, youQualified: false } }),
      entered({ bracket: [seat({ winnerUserId: 'u-2', decidedBy: 'walkover', isYours: true })] }),
      entered({ champion: { userId: 'u-2', displayName: 'Bo' }, qualification: { drawn: true, qualifiers: 4, yourSeed: null, youQualified: false } }),
    ]
    for (const world of worlds) {
      const model = buildChampionshipModel(source(world))
      expect(model.standing.kind === 'stated' && model.standing.outcome).not.toBe('eliminated')
    }
  })
})

describe('a read that did not answer is its own state', () => {
  it('reports the bracket unavailable without claiming anything about the player', () => {
    const model = buildChampionshipModel(source(null))
    expect(model.bracket).toEqual({ kind: 'unavailable' })
    expect(model.standing).toEqual({ kind: 'not-stated' })
  })

  it('reports a non-entrant as not entered, which is an ordinary answer', () => {
    const model = buildChampionshipModel(source({ entered: false }))
    expect(model.bracket).toEqual({ kind: 'not-entered' })
    expect(model.standing).toEqual({ kind: 'not-stated' })
  })
})

describe('the mapper is pure', () => {
  it('carries the instant it was given rather than reading a clock', () => {
    expect(buildChampionshipModel(source(entered())).generatedAt).toBe(NOW)
  })

  it('produces the same model twice from the same source', () => {
    const input = source(entered())
    expect(buildChampionshipModel(input)).toEqual(buildChampionshipModel(input))
  })
})

/**
 * THE PENALTY NUMBER PANEL, TESTED AT THE MAPPER.
 *
 * THESE CANNOT BE SURFACE TESTS. The Storybook worlds set `penaltyNumber`
 * directly, so they bypass this mapping entirely — two mutations here passed
 * every one of the 88 surface tests before these existed. A mapping only a
 * fixture stands in for is a mapping nothing checks.
 */
describe('the Penalty Number is mapped from two independent booleans', () => {
  const withPenalty = (over: Record<string, unknown>) =>
    entered({
      penaltyNumber: {
        windowId: 'w-1',
        windowLabel: 'Semi-finals',
        lane: 'odd' as const,
        submitted: false,
        value: null,
        version: 3,
        locksAt: '2027-05-02T14:00:00.000Z',
        locked: false,
        open: true,
        ...over,
      },
    })

  it('reads neither-locked-nor-open as unscheduled, not as locked', () => {
    // Contract 193 returns BOTH false when the round has no scheduled kickoff.
    // Reading `locked` as `!open` calls that round closed and tells a player
    // they missed a deadline that never existed.
    const model = buildChampionshipModel(
      source(withPenalty({ locked: false, open: false, locksAt: null })),
    )
    expect(model.penaltyNumber).toEqual({ kind: 'unscheduled' })
  })

  it('reads locked as locked', () => {
    const model = buildChampionshipModel(source(withPenalty({ locked: true, open: false, value: 37 })))
    expect(model.penaltyNumber).toEqual({ kind: 'locked', value: 37 })
  })

  it('treats a stored ZERO as a submission', () => {
    // `0` is legal in the even lane. Choosing the case on truthiness shows this
    // player an empty box and tells them they have not submitted.
    const model = buildChampionshipModel(
      source(withPenalty({ lane: 'even', submitted: true, value: 0 })),
    )
    expect(model.penaltyNumber).toEqual({
      kind: 'submitted',
      lane: 'even',
      value: 0,
      locksAt: '2027-05-02T14:00:00.000Z',
    })
  })

  it('reads an open round with no value as open', () => {
    const model = buildChampionshipModel(source(withPenalty({})))
    expect(model.penaltyNumber).toEqual({
      kind: 'open',
      lane: 'odd',
      locksAt: '2027-05-02T14:00:00.000Z',
    })
  })

  it('reports not-required where the read gave no Penalty Number at all', () => {
    const model = buildChampionshipModel(source(entered({ penaltyNumber: null })))
    expect(model.penaltyNumber).toEqual({ kind: 'not-required' })
  })

  it('reports not-required when the read did not answer', () => {
    expect(buildChampionshipModel(source(null)).penaltyNumber).toEqual({ kind: 'not-required' })
  })
})
