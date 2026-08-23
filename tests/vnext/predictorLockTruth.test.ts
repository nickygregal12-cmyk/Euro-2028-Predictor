import { describe, expect, it } from 'vitest'
import { predictorScenarios } from '../../src/vnext/fixtures'

/**
 * `ING-005` — WHERE THE PER-FIXTURE LOCK WILL LAND, PINNED BEFORE IT DOES.
 *
 * ============================ THE FINDING, IN ONE PARAGRAPH =============
 *
 * Contract 119 made prediction ENFORCEMENT per fixture: a fixture the provider
 * moved locks at its own kickoff rather than at the round's earliest. The card
 * read still publishes ONE instant for the whole matchweek. So a rescheduled
 * fixture reads as locked while the trigger would accept the write — the
 * surface is stricter than the rule. Nothing illegal becomes possible; a player
 * is told they cannot do something they can.
 *
 * ============================ WHY NO TEST HERE CAN FIX IT ===============
 *
 * Contract 119 chose the NARROW reading, on the owner's decision of 5 August
 * 2026: only a fixture with a row in `season_fixture_revisions` gets its own
 * lock, and an ordinary matchweek keeps locking together. "Has this moved?" is
 * therefore a stored fact with provenance, and no browser can see it.
 *
 * A mapper that inferred it — by comparing a fixture's kickoff against the
 * round's minimum, say — would implement the WIDE reading the owner rejected,
 * and an ordinary Friday-to-Monday matchweek would become predictable in
 * stages: Monday's game open after Saturday's results. That is a fairness
 * property, not a rounding difference.
 *
 * ============================ SO THIS PINS THE SHAPE ====================
 *
 * `PredictorFixture.editable` exists per fixture already, and its own docblock
 * says why: *"a future per-match lock policy needs no new field and no new
 * component"*. These cases hold that today every fixture takes the card's
 * answer, and that the narrowing the mapper does apply is a narrowing rather
 * than a widening. When the read starts publishing per-fixture editability, the
 * first assertion below is the one that changes, and it is one mapper line.
 */

describe('every fixture takes the card’s editability, for now', () => {
  it('marks every fixture editable while the matchweek is open', () => {
    const model = predictorScenarios.open
    expect(model.editable).toBe(true)
    // NO FIXTURE IS STRICTER THAN THE CARD while it is open. A per-fixture
    // policy can only ever EXTEND an editing window — contract 119 asserts that
    // property in the database for the same reason.
    for (const fixture of model.fixtures) {
      if (fixture.verdict !== null) continue
      expect(fixture.editable, `${fixture.id} is not editable on an open card`).toBe(true)
    }
  })

  it('marks NO fixture editable once the matchweek is locked', () => {
    // THIS IS THE ASSERTION `ING-005` CHANGES. Today the card's single instant
    // is the whole truth, so a rescheduled fixture is drawn locked with the
    // rest — stricter than the server, and the finding. When the read publishes
    // per-fixture editability, a moved fixture stays `true` here and this case
    // becomes "no fixture the SERVER locked is editable".
    const model = predictorScenarios.locked
    expect(model.editable).toBe(false)
    for (const fixture of model.fixtures) {
      expect(fixture.editable, `${fixture.id} is editable on a locked card`).toBe(false)
    }
  })

  it('never widens a fixture beyond the card, whatever else it decides', () => {
    // The mapper's own note: the card's `editable` is the authority and the
    // fixture-level answer "only ever NARROWS it". A settled fixture on an open
    // card is not editable; nothing is editable on a card that is not.
    for (const name of ['open', 'closing', 'complete', 'locked', 'settled'] as const) {
      const model = predictorScenarios[name]
      if (model.editable) continue
      expect(
        model.fixtures.every((fixture) => !fixture.editable),
        `${name} widens a fixture beyond its card`,
      ).toBe(true)
    }
  })
})

describe('the surface reads the model rather than a clock', () => {
  it('states the deadline it was given and does not resolve one', () => {
    // A COUNTDOWN OVER `lock.at` IS PRESENTATION; A PERMISSION FROM IT IS NOT.
    // `kind` came from the server's resolved state and is the only authority on
    // open or closed — which is exactly why publishing a per-fixture instant
    // alone would not be enough. It has to publish the ANSWER, not the input.
    const locked = predictorScenarios.locked
    expect(locked.lock.kind).toBe('closed')
    expect(locked.lock.urgency).toBeNull()
  })

  it('carries the instant it was given rather than one it resolved', () => {
    // `generatedAt` is the instant the model DESCRIBES, handed in rather than
    // read — a mapper that called `Date.now()` would resolve a deadline against
    // a device clock, which is the failure the whole lock vocabulary exists to
    // prevent. An open card's urgency is the model's answer about that instant,
    // not a comparison a component is invited to make.
    const open = predictorScenarios.open
    expect(open.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(open.lock.urgency).not.toBeNull()
  })
})
