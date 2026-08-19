import { describe, expect, it } from 'vitest'
import { buildLmsModel } from '../../src/vnext/integration/lms/buildLmsModel'
import type { LmsSource } from '../../src/vnext/integration/lms/lmsSource'
import type { LmsRoundPage } from '../../src/services/supabase/seasonLms'
import type { LmsPageModel, LmsTeamOption } from '../../src/vnext/models/lms'
import { first } from '../support/indexed'

/**
 * `LmsSource` → `LmsPageModel`, TESTED WHERE A SURVIVAL GAME LIES.
 *
 * The compiler covers field copying. These are the answers that would be WRONG
 * rather than merely different:
 *
 *   1. A TEAM ID EXISTS ONLY WHERE A PICK IS ALLOWED. The predicate requires
 *      that used and ineligible clubs cannot be made selectable by
 *      presentation shortcuts, and the model's answer is that they carry
 *      nothing to select with.
 *   2. SURVIVAL IS NEVER DERIVED FROM A RESULT. A club that won does not make
 *      a player safe; only the settlement job says that, in `entryOutcome`.
 *   3. THE LOCK IS JUDGED FROM THE SUPPLIED INSTANT, once, in the mapper — so
 *      the same payload gives two different answers at two instants, and a
 *      component never gets to disagree with the header.
 *   4. NOT OFFERED, NO ROUND, NOT ENTERED and UNAVAILABLE are four different
 *      sentences about four different subjects.
 */

const NOW = '2027-11-14T19:20:00.000Z'
const BEFORE = '2027-11-14T18:00:00.000Z'
const AFTER = '2027-11-14T21:00:00.000Z'

function club(teamId: string, name: string, used = false) {
  return { teamId, name, used }
}

function page(overrides: Partial<LmsRoundPage> = {}): LmsRoundPage {
  return {
    available: true,
    entered: true,
    entryOutcome: 'active',
    round: {
      windowId: 'window-7',
      sequence: 7,
      label: 'Round 7',
      opensAt: '2027-11-10T12:00:00.000Z',
      locksAt: AFTER,
    },
    fixtures: [
      {
        fixtureId: 'fx-1',
        kickoffAt: '2027-11-15T15:00:00.000Z',
        status: 'scheduled',
        home: club('team-celtic', 'Celtic'),
        away: club('team-hearts', 'Hearts', true),
        score: null,
      },
      {
        fixtureId: 'fx-2',
        kickoffAt: '2027-11-15T17:30:00.000Z',
        status: 'scheduled',
        home: club('team-aberdeen', 'Aberdeen'),
        away: club('team-hibs', 'Hibernian'),
        score: null,
      },
    ],
    pick: null,
    pickOutcome: null,
    ...overrides,
  }
}

function source(page_: LmsRoundPage | null, generatedAt = NOW): LmsSource {
  return {
    generatedAt,
    context: {
      tournamentId: 'tour-1',
      competitionName: 'Caledonian Premiership',
      seasonLabel: '2027/28',
      gameName: 'Last Man Standing',
    },
    read: page_ === null ? { kind: 'failed' } : { kind: 'ok', page: page_ },
  }
}

/** Every option on the page, both sides of every fixture. */
function options(model: LmsPageModel): LmsTeamOption[] {
  if (model.body.kind !== 'round') return []
  return model.body.round.choices.flatMap((choice) => [choice.home, choice.away])
}

function optionNamed(model: LmsPageModel, name: string): LmsTeamOption {
  const found = options(model).find((option) => option.name === name)
  if (found === undefined) throw new Error(`no option named ${name}`)
  return found
}

/* ------------------------------------------------------------------ *
 * 1. An ineligible club has nothing to pick with
 * ------------------------------------------------------------------ */

describe('a team id exists only where a pick is allowed', () => {
  it('gives a pickable club an id and a used club none', () => {
    const model = buildLmsModel(source(page()))

    const celtic = optionNamed(model, 'Celtic')
    const hearts = optionNamed(model, 'Hearts')

    expect(celtic.action).toEqual({ kind: 'pick', teamId: 'team-celtic' })
    expect(hearts.action).toEqual({ kind: 'used' })
    expect(JSON.stringify(hearts)).not.toContain('team-hearts')
  })

  it('carries no id anywhere on the page once the round is locked', () => {
    // THE STRUCTURAL ASSERTION. Not "the button is disabled" — there is nothing
    // on the page a submission could be built from.
    const model = buildLmsModel(source(page({ round: { windowId: 'window-7', sequence: 7, label: 'Round 7', opensAt: BEFORE, locksAt: BEFORE } })))

    for (const option of options(model)) {
      expect(option.action.kind).toBe('unavailable')
    }
    const drawn = JSON.stringify(options(model))
    expect(drawn).not.toContain('team-celtic')
    expect(drawn).not.toContain('team-aberdeen')
  })

  it('carries no id for a player who has not entered', () => {
    const model = buildLmsModel(source(page({ entered: false })))
    // Not entered is answered before the round is drawn at all.
    expect(model.body.kind).toBe('not-entered')
    expect(JSON.stringify(model)).not.toContain('team-celtic')
  })

  it('marks the held club without giving it back an id', () => {
    // Re-picking the club you already hold is a press that changes nothing, so
    // `chosen` carries nothing to press with.
    const model = buildLmsModel(source(page({ pick: { teamId: 'team-celtic' } })))
    const celtic = optionNamed(model, 'Celtic')

    expect(celtic.action).toEqual({ kind: 'chosen' })
    expect(JSON.stringify(celtic)).not.toContain('team-celtic')
  })

  it('keys a row by its fixture and side rather than by the club', () => {
    const model = buildLmsModel(source(page()))
    expect(optionNamed(model, 'Celtic').key).toBe('fx-1:home')
    expect(optionNamed(model, 'Hearts').key).toBe('fx-1:away')
  })
})

/* ------------------------------------------------------------------ *
 * 2. Survival is the settlement job's word
 * ------------------------------------------------------------------ */

describe('survival is never derived from a result', () => {
  it('keeps a player eliminated even though their club won', () => {
    // The world that makes the rule visible. A won pick and an eliminated
    // entry co-exist — some rules eliminate on a technicality the browser
    // cannot see — and the page must report what the competition decided.
    const model = buildLmsModel(
      source(page({ pickOutcome: 'won', entryOutcome: 'eliminated', pick: { teamId: 'team-celtic' } })),
    )

    expect(model.standing).toBe('eliminated')
    if (model.body.kind !== 'round') throw new Error('expected a round')
    expect(model.body.pick?.result).toBe('won')
  })

  it('keeps a player active even though their club lost', () => {
    const model = buildLmsModel(
      source(page({ pickOutcome: 'lost', entryOutcome: 'active', pick: { teamId: 'team-celtic' } })),
    )

    expect(model.standing).toBe('active')
    if (model.body.kind !== 'round') throw new Error('expected a round')
    expect(model.body.pick?.result).toBe('lost')
  })

  it('carries a postponed pick as a result that is not a verdict', () => {
    const model = buildLmsModel(
      source(page({ pickOutcome: 'postponed', entryOutcome: 'active', pick: { teamId: 'team-celtic' } })),
    )
    if (model.body.kind !== 'round') throw new Error('expected a round')
    expect(model.body.pick?.result).toBe('postponed')
    expect(model.standing).toBe('active')
  })

  it('carries every standing the competition can state', () => {
    for (const standing of ['active', 'qualified', 'survived', 'eliminated', 'champion'] as const) {
      expect(buildLmsModel(source(page({ entryOutcome: standing }))).standing).toBe(standing)
    }
  })

  it('reports no standing at all when the read did not answer', () => {
    // "active" here would tell somebody they are still in a competition this
    // page failed to read.
    expect(buildLmsModel(source(null)).standing).toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * 3. The lock is judged once, from the supplied instant
 * ------------------------------------------------------------------ */

describe('the lock is judged from the instant the source supplied', () => {
  it('gives the same payload two answers at two instants', () => {
    const before = buildLmsModel(source(page(), NOW))
    const after = buildLmsModel(source(page(), '2027-11-14T22:00:00.000Z'))

    if (before.body.kind !== 'round' || after.body.kind !== 'round') {
      throw new Error('expected rounds')
    }
    expect(before.body.round.state).toBe('open')
    expect(after.body.round.state).toBe('locked')
  })

  it('reads a round that has not opened as not-open rather than locked', () => {
    const model = buildLmsModel(
      source(page({ round: { windowId: 'w', sequence: 7, label: 'Round 7', opensAt: AFTER, locksAt: AFTER } })),
    )
    if (model.body.kind !== 'round') throw new Error('expected a round')
    expect(model.body.round.state).toBe('not-open')
    expect(first(options(model)).action).toEqual({ kind: 'unavailable', reason: 'not-open' })
  })

  it('treats an unscheduled window as not open rather than open forever', () => {
    // A null deadline is a window with nothing to beat, and the write would
    // have nothing to validate against.
    const model = buildLmsModel(
      source(page({ round: { windowId: 'w', sequence: 7, label: 'Round 7', opensAt: BEFORE, locksAt: null } })),
    )
    if (model.body.kind !== 'round') throw new Error('expected a round')
    expect(model.body.round.state).toBe('not-open')
  })

  it('reads a settled round as settled whatever its timestamps say', () => {
    const model = buildLmsModel(source(page({ pickOutcome: 'won', pick: { teamId: 'team-celtic' } })))
    if (model.body.kind !== 'round') throw new Error('expected a round')
    expect(model.body.round.state).toBe('settled')
  })

  it('carries the deadline beside the state, from the same value', () => {
    const model = buildLmsModel(source(page()))
    if (model.body.kind !== 'round') throw new Error('expected a round')
    expect(model.body.round.locksAt).toBe(AFTER)
  })
})

describe('the reason a pick is blocked names the right subject', () => {
  it('says eliminated rather than locked for a player who is out', () => {
    // ORDER MATTERS AND IT IS THE MESSAGE. A player who is out should be told
    // they are out, not that they were too slow.
    const model = buildLmsModel(
      source(
        page({
          entryOutcome: 'eliminated',
          round: { windowId: 'w', sequence: 7, label: 'Round 7', opensAt: BEFORE, locksAt: BEFORE },
        }),
      ),
    )
    expect(first(options(model)).action).toEqual({ kind: 'unavailable', reason: 'eliminated' })
  })
})

/* ------------------------------------------------------------------ *
 * 4. Four states, four subjects
 * ------------------------------------------------------------------ */

describe('four different sentences about four different subjects', () => {
  it('says the competition does not run this game', () => {
    expect(buildLmsModel(source(page({ available: false }))).body.kind).toBe('not-offered')
  })

  it('says there is no round rather than that the game is not offered', () => {
    expect(buildLmsModel(source(page({ round: null }))).body.kind).toBe('no-round')
  })

  it('says the player has not entered', () => {
    expect(buildLmsModel(source(page({ entered: false }))).body.kind).toBe('not-entered')
  })

  it('says the read did not answer', () => {
    expect(buildLmsModel(source(null)).body.kind).toBe('unavailable')
  })

  it('answers about the competition before the player', () => {
    // A season that does not run this game has no entry to have missed.
    const model = buildLmsModel(source(page({ available: false, entered: false })))
    expect(model.body.kind).toBe('not-offered')
  })
})

/* ------------------------------------------------------------------ *
 * 5. Eligibility is the server's
 * ------------------------------------------------------------------ */

describe('eligibility is the server`s flag, not a comparison here', () => {
  it('marks used exactly the clubs the payload marked', () => {
    const model = buildLmsModel(
      source(
        page({
          fixtures: [
            {
              fixtureId: 'fx-1',
              kickoffAt: null,
              status: 'scheduled',
              home: club('team-a', 'Celtic', true),
              away: club('team-b', 'Celtic', false),
              score: null,
            },
          ],
        }),
      ),
    )

    // TWO CLUBS WITH ONE NAME, one spent and one not. A mapper comparing names
    // would mark both, and a mapper comparing ids would get it right by luck
    // here and wrong the first time a name repeated.
    const drawn = options(model)
    expect(drawn[0]?.action.kind).toBe('used')
    expect(drawn[1]?.action).toEqual({ kind: 'pick', teamId: 'team-b' })
  })

  it('lists the used club names without inventing any', () => {
    expect(buildLmsModel(source(page())).usedClubNames).toEqual(['Hearts'])
  })
})

describe('the mapper is pure', () => {
  it('carries the instant it was given rather than reading a clock', () => {
    expect(buildLmsModel(source(page())).generatedAt).toBe(NOW)
  })

  it('produces the same model twice from the same source', () => {
    const input = source(page())
    expect(buildLmsModel(input)).toEqual(buildLmsModel(input))
  })
})
