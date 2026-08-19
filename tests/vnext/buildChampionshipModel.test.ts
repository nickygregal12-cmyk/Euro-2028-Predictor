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

/**
 * A ROW OF `my_ties`, which contract 193 emits for every tie the caller has
 * PLAYED OR IS PLAYING — settled ones included. `isHome` is the server's own
 * statement of which side of the tie the caller is.
 */
function myTie(over: Record<string, unknown> = {}) {
  return {
    fixtureId: 'fx-1',
    stage: 'knockout' as const,
    windowSequence: 21,
    windowLabel: 'Semi-finals',
    isHome: true,
    opponent: { userId: 'u-2', displayName: 'Bo' },
    settled: false,
    youWon: false,
    decidedBy: null,
    settledAt: null,
    ...over,
  }
}

function entered(over: Partial<Extract<SeasonCupBracket, { entered: true }>> = {}) {
  return {
    entered: true as const,
    serverNow: NOW,
    // Contract 207. `null` is the pre-208 database and is the honest default
    // here: the standing tests below assert what the surface says when the read
    // states nothing, which is still a state a hosted environment can be in.
    yourOutcome: null,
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
    // The caller's own tie, present because the default carries a live `myTie`
    // for the same fixture. A payload with one and not the other is not one the
    // server emits.
    myTies: [myTie()],
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
    // Contract 167 is asked for separately and answers separately. Defaulted to
    // "no group stage" so the bracket tests below say nothing about groups.
    groupStage: { kind: 'ok', groupStage: { available: false } },
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
 * WHO THE READER IS. `is_yours` marks a SEAT; it does not say which SIDE of it
 * the caller holds. Deriving the side by subtracting the current opponent marks
 * the WRONG PLAYER as soon as the caller was the away side of an earlier round,
 * and marks NOBODY once the final settles and the live tie disappears.
 */
describe('the reader is named by the server, not derived', () => {
  it('marks the away side when that is the side the caller held', () => {
    const model = buildChampionshipModel(
      source(
        entered({
          // Round 21: the caller is AWAY to Al. Round 22: a live tie against Bo.
          bracket: [
            seat({
              fixtureId: 'fx-1',
              windowSequence: 21,
              home: { userId: 'u-A', displayName: 'Al' },
              away: { userId: 'u-me', displayName: 'Ada' },
              winnerUserId: 'u-me',
              decidedBy: 'points',
            }),
            seat({
              fixtureId: 'fx-2',
              windowSequence: 22,
              roundSize: 2,
              windowLabel: 'Final',
              home: { userId: 'u-me', displayName: 'Ada' },
              away: { userId: 'u-B', displayName: 'Bo' },
            }),
          ],
          myTies: [
            myTie({
              fixtureId: 'fx-1',
              isHome: false,
              opponent: { userId: 'u-A', displayName: 'Al' },
              settled: true,
              youWon: true,
              decidedBy: 'points',
            }),
            myTie({
              fixtureId: 'fx-2',
              windowSequence: 22,
              windowLabel: 'Final',
              opponent: { userId: 'u-B', displayName: 'Bo' },
            }),
          ],
          myTie: {
            fixtureId: 'fx-2',
            stage: 'knockout' as const,
            roundSize: 2,
            bracketSlot: 1,
            windowSequence: 22,
            windowLabel: 'Final',
            isHome: true,
            opponent: { userId: 'u-B', displayName: 'Bo' },
            locksAt: null,
          },
        }),
      ),
    )
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    const marked = model.bracket.seats.flatMap((s) =>
      [s.home, s.away].flatMap((side) =>
        side.kind === 'player' && side.isYou ? [side.displayName] : [],
      ),
    )
    // Ada in both rounds. Al — the earlier opponent — in neither.
    expect(marked).toEqual(['Ada', 'Ada'])
  })

  it('marks nobody when the caller holds no tie in the bracket', () => {
    const model = buildChampionshipModel(source(entered({ myTies: [] })))
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    const marked = model.bracket.seats.flatMap((s) =>
      [s.home, s.away].filter((side) => side.kind === 'player' && side.isYou),
    )
    expect(marked).toEqual([])
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
            myTie({
              settled: true,
              youWon: false,
              decidedBy: 'points',
              settledAt: '2027-05-02T18:00:00.000Z',
            }),
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

  // THE PAYLOAD A CHAMPION ACTUALLY RECEIVES. `my_tie` filters
  // `winner_user_id is null`, so the player who has just won the final has NO
  // live tie: `myTie` and `penaltyNumber` are both null. A test that pairs a
  // champion with a live tie is testing a payload the server cannot emit, and
  // for four commits that is what this one did.
  function afterTheFinal(over: Record<string, unknown> = {}) {
    return entered({
      myTie: null,
      penaltyNumber: null,
      myTies: [myTie({ fixtureId: 'fx-final', settled: true, youWon: true, decidedBy: 'points' })],
      bracket: [seat({ fixtureId: 'fx-final', roundSize: 2, winnerUserId: 'u-me', decidedBy: 'points' })],
      champion: { userId: 'u-me', displayName: 'Ada' },
      ...over,
    })
  }

  it('does NOT call the reader champion from the bracket alone', () => {
    // CONTRACT 207 CHANGED THIS ON PURPOSE, and it is a narrowing rather than
    // a loss. Winning the final is a fact about a FIXTURE; being the champion
    // is a fact about an ENTRANT, and the settlement job is what moves one to
    // the other. The bracket panel still announces the winner — see the
    // `champion` assertion below — but the VERDICT slot now speaks only for the
    // settlement authority's own column.
    const model = buildChampionshipModel(source(afterTheFinal()))
    expect(model.standing).toEqual({ kind: 'not-stated' })
  })

  it('states champion when the settlement authority says so', () => {
    const model = buildChampionshipModel(source(afterTheFinal({ yourOutcome: 'champion' })))
    expect(model.standing).toEqual({ kind: 'stated', outcome: 'champion' })
  })

  it('marks the champion as the reader on a post-final payload', () => {
    const model = buildChampionshipModel(source(afterTheFinal()))
    if (model.bracket.kind !== 'bracket') throw new Error('expected a bracket')
    expect(model.bracket.champion).toEqual({ displayName: 'Ada', isYou: true })
  })

  it('does not call the caller champion when somebody else won', () => {
    const model = buildChampionshipModel(
      source(
        afterTheFinal({
          myTies: [
            myTie({ fixtureId: 'fx-final', settled: true, youWon: false, decidedBy: 'points' }),
          ],
          bracket: [
            seat({ fixtureId: 'fx-final', roundSize: 2, winnerUserId: 'u-2', decidedBy: 'points' }),
          ],
          champion: { userId: 'u-2', displayName: 'Bo' },
        }),
      ),
    )
    // Somebody else's name on the final says nothing about this reader, and
    // the read carried no outcome here.
    expect(model.standing).toEqual({ kind: 'not-stated' })
  })

  it('carries every one of the five stored outcomes, verbatim', () => {
    // The check constraint's whole vocabulary, so a mapper that recognised four
    // and dropped the fifth fails here rather than on a live competition.
    for (const outcome of ['active', 'qualified', 'survived', 'eliminated', 'champion'] as const) {
      const model = buildChampionshipModel(source(entered({ yourOutcome: outcome })))
      expect(model.standing).toEqual({ kind: 'stated', outcome })
    }
  })

  it('never produces an outcome the read did not carry', () => {
    // THE ASSERTION THIS BLOCK EXISTS FOR, unchanged in intent and now stronger
    // in reach: every world below is shaped like a defeat or a victory, and
    // none of them carries an outcome. The standing must be silent in all of
    // them, which is what stops a fallback creeping back in the day a hosted
    // environment sits behind contract 207.
    const worlds = [
      entered({ qualification: { drawn: true, qualifiers: 4, yourSeed: null, youQualified: false } }),
      entered({ bracket: [seat({ winnerUserId: 'u-2', decidedBy: 'walkover', isYours: true })] }),
      entered({ champion: { userId: 'u-2', displayName: 'Bo' }, qualification: { drawn: true, qualifiers: 4, yourSeed: null, youQualified: false } }),
      afterTheFinal(),
    ]
    for (const world of worlds) {
      expect(buildChampionshipModel(source(world)).standing).toEqual({ kind: 'not-stated' })
    }
  })

  it('keeps the draw fact out of the verdict and still reports it', () => {
    // `you_qualified` is `exists(member.seed is not null)` — permanently true
    // once a seed is dealt and never false again. An eliminated player who was
    // seeded is BOTH, and the model has a field for each.
    const model = buildChampionshipModel(
      source(
        entered({
          yourOutcome: 'eliminated',
          qualification: { drawn: true, qualifiers: 4, yourSeed: 2, youQualified: true },
        }),
      ),
    )
    expect(model.standing).toEqual({ kind: 'stated', outcome: 'eliminated' })
    expect(model.seededIntoKnockout).toBe(true)
  })

  it('reports no draw fact where the server did not state one', () => {
    const model = buildChampionshipModel(
      source(
        entered({
          qualification: { drawn: false, qualifiers: 0, yourSeed: null, youQualified: false },
        }),
      ),
    )
    expect(model.seededIntoKnockout).toBe(false)
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

/**
 * CONTRACT 167 → THE GROUP PANEL. It is carried, never computed: the rank the
 * server sent is the rank printed, in the position it arrived.
 */
describe('the group stage is carried, never recomputed', () => {
  function groupStage(over: Record<string, unknown> = {}) {
    return {
      available: true as const,
      entered: true as const,
      competition: {
        id: 'c-1',
        name: 'Caledonian Premiership',
        seasonName: '2027/28',
        seasonKey: null,
        visibility: null,
        completedAt: null,
      },
      groupCount: 1,
      myGroupOrdinal: 1,
      matchdays: 3,
      groups: [
        {
          groupId: 'g-a',
          ordinal: 1,
          size: 2,
          isMyGroup: true,
          rows: [
            {
              rank: 2,
              userId: 'u-me',
              displayName: 'Ada',
              isMe: true,
              drawNumber: 1,
              tablePoints: 4,
              pointsFor: 6,
              pointsAgainst: 5,
              windowPoints: 4,
              exacts: 1,
              corrects: 2,
              scorelineError: null,
            },
            {
              rank: 1,
              userId: 'u-2',
              displayName: 'Bo',
              isMe: false,
              drawNumber: 2,
              tablePoints: 7,
              pointsFor: 9,
              pointsAgainst: 2,
              windowPoints: 7,
              exacts: 2,
              corrects: 3,
              scorelineError: 3,
            },
          ],
        },
      ],
      ...over,
    }
  }

  function withGroups(stage: unknown) {
    const base = source(entered())
    return { ...base, groupStage: { kind: 'ok' as const, groupStage: stage as never } }
  }

  it('prints the rows in the order the server sent them, unsorted', () => {
    const model = buildChampionshipModel(withGroups(groupStage()))
    if (model.groups.kind !== 'groups') throw new Error('expected groups')
    // Rank 2 arrived FIRST. A surface that sorted would put Bo on top; the
    // standings authority's order is the one printed.
    expect(model.groups.groups[0]?.rows.map((r) => r.rank)).toEqual([2, 1])
  })

  it('takes `isYou` from the server flag rather than matching a name', () => {
    const model = buildChampionshipModel(withGroups(groupStage()))
    if (model.groups.kind !== 'groups') throw new Error('expected groups')
    expect(model.groups.groups[0]?.rows.map((r) => r.isYou)).toEqual([true, false])
  })

  it('keeps a null scoreline error null, because it is not an error of zero', () => {
    const model = buildChampionshipModel(withGroups(groupStage()))
    if (model.groups.kind !== 'groups') throw new Error('expected groups')
    expect(model.groups.groups[0]?.rows[0]?.scorelineError).toBeNull()
  })

  it('distinguishes holding no group from there being no groups', () => {
    const model = buildChampionshipModel(withGroups(groupStage({ myGroupOrdinal: null })))
    if (model.groups.kind !== 'groups') throw new Error('expected groups')
    expect(model.groups.yourOrdinal).toBeNull()
    expect(model.groups.groups.length).toBe(1)
  })

  it('says `no-groups` when the competition has no group stage', () => {
    expect(buildChampionshipModel(withGroups({ available: false })).groups).toEqual({
      kind: 'no-groups',
    })
  })

  it('says `not-entered` when the caller is not in the group stage', () => {
    const model = buildChampionshipModel(
      withGroups({
        available: true,
        entered: false,
        competition: { id: 'c-1', name: 'Caledonian Premiership', seasonName: '2027/28' },
      }),
    )
    expect(model.groups).toEqual({ kind: 'not-entered' })
  })

  it('says `unavailable` when contract 167 failed, without touching the bracket', () => {
    const base = source(entered())
    const model = buildChampionshipModel({ ...base, groupStage: { kind: 'failed' } })
    expect(model.groups).toEqual({ kind: 'unavailable' })
    expect(model.bracket.kind).toBe('bracket')
  })
})

/**
 * `qualification.drawn` IS BROADER THAN ITS NAME, and both halves of the
 * not-drawn check are load-bearing. Contract 193 computes it as
 * `exists(fixture.stage <> 'group')`, which a `split` fixture satisfies.
 */
describe('a split competition is not reported as drawn', () => {
  it('says not-drawn when the server says drawn and no seat survived the filter', () => {
    // What a split `single_group` competition sends: `drawn` true, because
    // `split` fixtures exist — and no seats, because the decoder drops them.
    const model = buildChampionshipModel(
      source(entered({ qualification: { drawn: true, qualifiers: 4, yourSeed: 2, youQualified: true }, bracket: [] })),
    )
    expect(model.bracket).toEqual({ kind: 'not-drawn' })
  })

  it('says not-drawn when the server says undrawn, whatever else arrived', () => {
    const model = buildChampionshipModel(
      source(entered({ qualification: { drawn: false, qualifiers: 4, yourSeed: 2, youQualified: true } })),
    )
    expect(model.bracket).toEqual({ kind: 'not-drawn' })
  })
})

/**
 * THE INSTANT THE MODEL IS READ AGAINST.
 *
 * `generatedAt` decides only whether a lock label says "today" or "tomorrow",
 * which is a question about the SERVER's clock. Contract 193 returns
 * `server_now` and the mapper was discarding it in favour of a browser clock,
 * so a device an hour fast printed the wrong day for the lock.
 */
describe('the clock is the database’s where the database supplied one', () => {
  it('prefers `server_now` over the instant this process stamped', () => {
    const model = buildChampionshipModel(
      source(entered({ serverNow: '2027-06-09T09:30:00.000Z' })),
    )
    expect(model.generatedAt).toBe('2027-06-09T09:30:00.000Z')
  })

  it('falls back to the supplied instant when the read did not answer', () => {
    expect(buildChampionshipModel(source(null)).generatedAt).toBe(NOW)
  })
})
