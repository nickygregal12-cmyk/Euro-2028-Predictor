import { describe, expect, it } from 'vitest'
import {
  type LmsRoundPage,
  presentLmsRound,
} from '../../../src/features/season/lmsRoundModel'

/**
 * The season Last Man Standing round model.
 *
 * The assertions that matter are the ones holding the line between what the
 * pick DID and what the player IS. Only the settlement job decides survival,
 * and whether a draw eliminates is a stored rule the browser cannot see — so a
 * drawn pick must never render as an elimination, and an eliminated player must
 * never be inferred from anything but the server's own `entryOutcome`.
 */

const NOW = new Date('2026-08-05T12:00:00Z')

function club(teamId: string, name: string, used = false) {
  return { teamId, name, used }
}

function page(over: Partial<LmsRoundPage> = {}): LmsRoundPage {
  return {
    available: true,
    entered: true,
    entryOutcome: 'active',
    round: {
      windowId: 'w2',
      sequence: 2,
      label: 'Round 2',
      opensAt: '2026-08-04T12:00:00Z',
      locksAt: '2026-08-07T12:00:00Z',
    },
    fixtures: [
      {
        fixtureId: 'f1',
        kickoffAt: '2026-08-07T14:00:00Z',
        status: 'scheduled',
        home: club('gamma', 'Gamma'),
        away: club('delta', 'Delta'),
        score: null,
      },
    ],
    pick: null,
    pickOutcome: null,
    ...over,
  }
}

describe('the season LMS round model', () => {
  it('lets an active entrant pick inside an open round', () => {
    const view = presentLmsRound(page(), NOW)
    expect(view.canPick).toBe(true)
    expect(view.refusal).toBeNull()
    expect(view.choices.map((c) => c.name)).toEqual(['Gamma', 'Delta'])
  })

  it('never reads a drawn pick as an elimination', () => {
    // The whole point. Whether a draw eliminates is a stored rule; a browser
    // that decided it here would be wrong in exactly the seasons that
    // configure it differently.
    const view = presentLmsRound(page({ pickOutcome: 'drew', entryOutcome: 'active' }), NOW)
    expect(view.outcomeLine).toBe('Your pick drew.')
    expect(view.statusLine).toBe('You are still in.')
    expect(view.canPick).toBe(true)
  })

  it('reports elimination only when the server says so', () => {
    const view = presentLmsRound(page({ pickOutcome: 'lost', entryOutcome: 'eliminated' }), NOW)
    expect(view.statusLine).toBe('You have been eliminated.')
    expect(view.canPick).toBe(false)
    expect(view.refusal).toBe('You have been eliminated, so this round is read-only.')
  })

  it('does not eliminate on absent information', () => {
    const view = presentLmsRound(page({ pickOutcome: 'postponed' }), NOW)
    expect(view.outcomeLine).toContain('never eliminates')
    expect(view.canPick).toBe(true)
  })

  it('refuses a pick once the round has locked', () => {
    const locked = page({
      round: {
        windowId: 'w1',
        sequence: 1,
        label: 'Round 1',
        opensAt: '2026-08-01T12:00:00Z',
        locksAt: '2026-08-04T12:00:00Z',
      },
    })
    const view = presentLmsRound(locked, NOW)
    expect(view.canPick).toBe(false)
    expect(view.refusal).toBe('This round is locked.')
  })

  it('refuses a pick before the round opens', () => {
    const early = page({
      round: {
        windowId: 'w3',
        sequence: 3,
        label: 'Round 3',
        opensAt: '2026-08-09T12:00:00Z',
        locksAt: '2026-08-11T12:00:00Z',
      },
    })
    expect(presentLmsRound(early, NOW).refusal).toBe('This round has not opened yet.')
  })

  it('shows the round to a non-entrant but refuses the pick', () => {
    const view = presentLmsRound(page({ entered: false, entryOutcome: null }), NOW)
    expect(view.refusal).toBe('Join Last Man Standing to make a pick.')
    expect(view.statusLine).toBe('You are not entered in this competition.')
    // Still offered, because deciding whether to join needs to see them.
    expect(view.choices).toHaveLength(2)
  })

  it('says so plainly when the competition has not launched', () => {
    const view = presentLmsRound(page({ available: false, round: null, fixtures: [] }), NOW)
    expect(view.refusal).toBe('Last Man Standing has not started for this season yet.')
    expect(view.choices).toHaveLength(0)
  })

  it('carries the used flag through so a consumed club is not offered again', () => {
    const view = presentLmsRound(
      page({
        fixtures: [
          {
            fixtureId: 'f1',
            kickoffAt: null,
            status: 'scheduled',
            home: club('gamma', 'Gamma', true),
            away: club('delta', 'Delta'),
            score: null,
          },
        ],
      }),
      NOW,
    )
    expect(view.choices.map((c) => c.used)).toEqual([true, false])
  })

  it('treats a champion as still standing rather than as a refusal reason', () => {
    const view = presentLmsRound(page({ entryOutcome: 'champion' }), NOW)
    expect(view.statusLine).toBe('You are the last one standing.')
  })
})
