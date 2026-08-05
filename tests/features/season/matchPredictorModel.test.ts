import { describe, expect, it } from 'vitest'
import type { ResolvedLockState } from '../../../src/domain/competition/lockState'
import type { CardStatus } from '../../../src/domain/season/cardSubmission'
import { resolveCardAtLock } from '../../../src/domain/season/cardSubmission'
import {
  type MatchPredictorFixture,
  type MatchPredictorPage,
  commandRefusal,
  presentCard,
} from '../../../src/features/season/matchPredictorModel'
import { explainLock } from '../../../src/features/season/lockExplanation'

/**
 * The season Match Predictor page model, against the plan's state machine and
 * the domain authority it must agree with.
 *
 * §12.1 fixes the states and the Match Predictor lock branch: an interacted card
 * banks what the player entered, blanks score zero, and an untouched matchweek
 * is UNBANKED. `resolveCardAtLock` is the executable authority for the lock
 * instant. This suite's most important assertions are the ones that hold the
 * page's *prediction* about the lock against what the domain will actually do —
 * a surface that promises "this will bank" and a domain that then discards it
 * would be the worst defect this feature could ship, and neither side's own
 * tests would catch it.
 */

const OPEN: ResolvedLockState = {
  status: 'open',
  locked: false,
  lockAt: '2027-08-14T14:00:00.000Z',
  reason: 'before_scope_lock',
}
const LOCKED: ResolvedLockState = {
  status: 'locked',
  locked: true,
  lockAt: '2027-08-14T14:00:00.000Z',
  reason: 'scope_lock_reached',
}
const UNRESOLVABLE: ResolvedLockState = {
  status: 'locked',
  locked: true,
  lockAt: null,
  reason: 'missing_fixture_data',
}

function fixture(id: string, prediction: { home: number; away: number } | null = null): MatchPredictorFixture {
  return {
    fixtureId: id,
    kickoffAt: '2027-08-14T14:00:00.000Z',
    home: { name: 'Home', shortName: 'Home', tokens: { monogram: 'HOM', primary: '#111111' } },
    away: { name: 'Away', shortName: 'Away', tokens: { monogram: 'AWY', primary: '#333333' } },
    prediction,
    result: null,
    points: null,
  }
}

function page(overrides: Partial<MatchPredictorPage> = {}): MatchPredictorPage {
  return {
    competition: { name: 'Preview League', seasonLabel: 'Main Predictor', timeZone: 'Europe/London' },
    matchweek: { number: 1, of: 38 },
    fixtures: [fixture('a'), fixture('b')],
    cardStatus: 'no_submission',
    lock: OPEN,
    joker: { playedHere: false, remainingThisHalf: 5, playable: true },
    settledPoints: null,
    ...overrides,
  }
}

describe('the card state machine', () => {
  it('calls an untouched open matchweek not_created, and says it banks nothing', () => {
    const presentation = presentCard(page({ cardStatus: 'no_submission' }), false)
    expect(presentation.state).toBe('not_created')
    expect(presentation.atLock).toBe('unbanked')
    expect(presentation.editable).toBe(true)
  })

  it('separates an engaged-but-blank card from an untouched one', () => {
    // Both bank nothing scoreable, but the ledger distinguishes "never engaged"
    // from "engaged and left blank" and so must the surface.
    const untouched = presentCard(page({ cardStatus: 'no_submission' }), false)
    const engaged = presentCard(page({ cardStatus: 'provisional' }), false)
    expect(untouched.state).toBe('not_created')
    expect(engaged.state).toBe('active_empty')
    expect(engaged.atLock).toBe('banks_entered')
  })

  it('reports partial and complete progress on an engaged card', () => {
    const partial = presentCard(
      page({ cardStatus: 'provisional', fixtures: [fixture('a', { home: 1, away: 0 }), fixture('b')] }),
      false,
    )
    expect(partial.state).toBe('active_in_progress')
    expect(partial.entered).toBe(1)

    const complete = presentCard(
      page({
        cardStatus: 'provisional',
        fixtures: [fixture('a', { home: 1, away: 0 }), fixture('b', { home: 2, away: 2 })],
      }),
      false,
    )
    expect(complete.state).toBe('active_complete')
  })

  it('locks and then scores, and stops predicting the lock once it has passed', () => {
    const locked = presentCard(page({ lock: LOCKED, cardStatus: 'provisional' }), false)
    expect(locked.state).toBe('locked')
    expect(locked.editable).toBe(false)
    expect(locked.atLock).toBeNull()

    const scored = presentCard(page({ lock: LOCKED, cardStatus: 'provisional', settledPoints: 8 }), false)
    expect(scored.state).toBe('scored_final')
  })

  it('ranks a conflict above every other state', () => {
    // The page is knowingly showing data the server has already changed. Any
    // other state would invite an edit against a version we know is stale.
    const conflicted = presentCard(page({ cardStatus: 'provisional' }), true)
    expect(conflicted.state).toBe('conflict_requires_refresh')
    expect(conflicted.editable).toBe(false)
  })

  it('distinguishes an unresolvable lock from a passed deadline', () => {
    const unavailable = presentCard(page({ lock: UNRESOLVABLE }), false)
    expect(unavailable.state).toBe('unavailable')
    expect(unavailable.editable).toBe(false)
    expect(unavailable.lock.retryable).toBe(true)
  })
})

describe('the page and the domain agree about what happens at the lock', () => {
  const cases: readonly { status: CardStatus; entered: readonly (string | null)[] }[] = [
    { status: 'no_submission', entered: [] },
    { status: 'provisional', entered: [] },
    { status: 'provisional', entered: ['a'] },
    { status: 'confirmed', entered: ['a', 'b'] },
  ]

  it.each(cases)('$status with $entered.length entered', ({ status, entered }) => {
    const fixtures = ['a', 'b'].map((id) =>
      entered.includes(id) ? fixture(id, { home: 1, away: 0 }) : fixture(id),
    )
    const presentation = presentCard(page({ cardStatus: status, fixtures }), false)
    const resolution = resolveCardAtLock(
      fixtures.map((f) => ({ fixtureId: f.fixtureId, playerPrediction: f.prediction })),
      status,
    )

    // The page's promise and the domain's behaviour must be the same fact.
    if (resolution.kind === 'unbanked') {
      expect(presentation.atLock).toBe('unbanked')
    } else if (resolution.kind === 'submitted') {
      expect(presentation.atLock).toBe('banks_entered')
      expect(resolution.predictions).toHaveLength(presentation.entered)
    }
  })
})

describe('command legality', () => {
  const open = presentCard(page({ cardStatus: 'provisional', fixtures: [fixture('a', { home: 1, away: 0 })] }), false)
  const joker = { playedHere: false, remainingThisHalf: 5, playable: true }

  it('permits editing an open card', () => {
    expect(commandRefusal(open, { kind: 'setPrediction', fixtureId: 'a', prediction: null }, joker)).toBeNull()
  })

  it('refuses every command on a locked card', () => {
    const locked = presentCard(page({ lock: LOCKED }), false)
    expect(commandRefusal(locked, { kind: 'setJoker', played: true }, joker)).toBe(
      'This matchweek is locked.',
    )
  })

  it('explains a conflict rather than reporting it as a lock', () => {
    const conflicted = presentCard(page({ cardStatus: 'provisional' }), true)
    expect(commandRefusal(conflicted, { kind: 'confirmCard' }, joker)).toMatch(/changed somewhere else/)
  })

  it('refuses a Joker the allowance does not permit', () => {
    const spent = { playedHere: false, remainingThisHalf: 0, playable: false }
    expect(commandRefusal(open, { kind: 'setJoker', played: true }, spent)).toMatch(/no Jokers left/)
    // Taking one back is always allowed — that returns an allowance, never spends it.
    expect(commandRefusal(open, { kind: 'setJoker', played: false }, spent)).toBeNull()
  })

  it('refuses confirming a card with nothing entered', () => {
    const empty = presentCard(page({ cardStatus: 'provisional' }), false)
    expect(commandRefusal(empty, { kind: 'confirmCard' }, joker)).toMatch(/at least one prediction/)
  })
})

describe('lock explanation', () => {
  it('never presents a locked scope as open', () => {
    expect(explainLock({ ...OPEN, locked: true, status: 'locked' }).kind).toBe('closed')
  })

  it('marks only the fail-closed reasons retryable', () => {
    expect(explainLock(LOCKED).retryable).toBe(false)
    expect(explainLock(UNRESOLVABLE).retryable).toBe(true)
  })

  it('covers every reason the domain can return', () => {
    // A missing entry would fall through to `undefined` and crash the page on
    // whichever unusual lock produced it — exactly the states that matter.
    const reasons = [
      'before_scope_lock',
      'scope_lock_reached',
      'match_kickoff_reached',
      'already_locked',
      'missing_fixture_data',
      'stale_fixture_data',
      'invalid_fixture_data',
      'invalid_time',
    ] as const
    for (const reason of reasons) {
      const explanation = explainLock({ status: 'locked', locked: true, lockAt: null, reason })
      expect(explanation.label.length, reason).toBeGreaterThan(0)
      expect(explanation.detail.length, reason).toBeGreaterThan(0)
    }
  })
})
