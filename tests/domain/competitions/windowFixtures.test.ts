import { describe, expect, it } from 'vitest'
import {
  deriveWindowFixtureAggregate,
  MATCH_IN_PLAY_WINDOW_MINUTES,
} from '../../../src/domain/competitions/windowFixtures'

const NOW = new Date('2028-06-29T20:00:00Z')

describe('deriveWindowFixtureAggregate', () => {
  it('counts confirmed and corrected results as confirmed', () => {
    expect(
      deriveWindowFixtureAggregate(
        [
          { kickoffAt: '2028-06-29T15:00:00Z', resultState: 'confirmed' },
          { kickoffAt: '2028-06-29T12:00:00Z', resultState: 'corrected' },
        ],
        NOW,
      ),
    ).toEqual({ total: 2, live: 0, awaitingConfirmation: 0, confirmed: 2 })
  })

  it('reads a fixture as in play once kickoff has passed without a result', () => {
    expect(
      deriveWindowFixtureAggregate(
        [{ kickoffAt: '2028-06-29T19:00:00Z', resultState: 'scheduled' }],
        NOW,
      ),
    ).toEqual({ total: 1, live: 1, awaitingConfirmation: 0, confirmed: 0 })
  })

  it('moves an unconfirmed fixture to awaiting confirmation after the in-play window', () => {
    const kickoff = new Date(
      NOW.getTime() - MATCH_IN_PLAY_WINDOW_MINUTES * 60_000,
    ).toISOString()
    expect(deriveWindowFixtureAggregate([{ kickoffAt: kickoff, resultState: 'scheduled' }], NOW))
      .toEqual({ total: 1, live: 0, awaitingConfirmation: 1, confirmed: 0 })
  })

  it('treats future and unscheduled kickoffs as neither live nor awaiting', () => {
    expect(
      deriveWindowFixtureAggregate(
        [
          { kickoffAt: '2028-06-30T15:00:00Z', resultState: 'scheduled' },
          { kickoffAt: null, resultState: 'scheduled' },
        ],
        NOW,
      ),
    ).toEqual({ total: 2, live: 0, awaitingConfirmation: 0, confirmed: 0 })
  })

  it('ignores an unparseable kickoff instead of guessing a boundary', () => {
    expect(
      deriveWindowFixtureAggregate([{ kickoffAt: 'not-a-date', resultState: 'scheduled' }], NOW),
    ).toEqual({ total: 1, live: 0, awaitingConfirmation: 0, confirmed: 0 })
  })
})
