import { describe, expect, it } from 'vitest'
import { resolveMatchState, type MatchStateInput } from '../../../src/domain/competition/matchState'
import type { ResolvedLockState } from '../../../src/domain/competition/lockState'

const OPEN_LOCK: ResolvedLockState = {
  status: 'open',
  locked: false,
  lockAt: '2028-06-10T18:00:00.000Z',
  reason: 'before_scope_lock',
}

const LOCKED: ResolvedLockState = {
  status: 'locked',
  locked: true,
  lockAt: '2028-06-10T18:00:00.000Z',
  reason: 'scope_lock_reached',
}

function input(overrides: Partial<MatchStateInput> = {}): MatchStateInput {
  return {
    kickoffAt: '2028-06-10T18:00:00Z',
    administrationState: 'scheduled',
    officialState: 'unconfirmed',
    lockState: OPEN_LOCK,
    liveData: null,
    ...overrides,
  }
}

describe('resolveMatchState — every state named in architecture §4', () => {
  it('resolves scheduled_editable', () => {
    expect(resolveMatchState(input(), new Date('2028-06-10T17:00:00Z'))).toBe('scheduled_editable')
  })

  it('resolves scheduled_locked', () => {
    expect(resolveMatchState(input({ lockState: LOCKED }), new Date('2028-06-10T17:00:00Z'))).toBe('scheduled_locked')
  })

  it('resolves in_play_feed when score and minute data are usable', () => {
    expect(
      resolveMatchState(
        input({ liveData: { state: 'in_play', homeScore: 1, awayScore: 0, minute: 34 } }),
        new Date('2028-06-10T18:34:00Z'),
      ),
    ).toBe('in_play_feed')
  })

  it('resolves in_play_no_feed after kickoff without usable feed data', () => {
    expect(resolveMatchState(input(), new Date('2028-06-10T18:34:00Z'))).toBe('in_play_no_feed')
  })

  it('resolves suspended from the feed signal', () => {
    expect(
      resolveMatchState(
        input({ liveData: { state: 'suspended', homeScore: 1, awayScore: 1, minute: 62 } }),
        new Date('2028-06-10T19:15:00Z'),
      ),
    ).toBe('suspended')
  })

  it('resolves full_time_unconfirmed from a full-time feed', () => {
    expect(
      resolveMatchState(
        input({ liveData: { state: 'full_time', homeScore: 2, awayScore: 1, minute: 90 } }),
        new Date('2028-06-10T20:00:00Z'),
      ),
    ).toBe('full_time_unconfirmed')
  })

  it('resolves full_time_unconfirmed from the feed-less two-hour heuristic', () => {
    expect(resolveMatchState(input(), new Date('2028-06-10T20:00:00Z'))).toBe('full_time_unconfirmed')
  })

  it('resolves confirmed', () => {
    expect(
      resolveMatchState(input({ officialState: 'confirmed' }), new Date('2028-06-10T20:00:00Z')),
    ).toBe('confirmed')
  })

  it('resolves scored', () => {
    expect(resolveMatchState(input({ officialState: 'scored' }), new Date('2028-06-10T20:00:00Z'))).toBe('scored')
  })

  it('resolves postponed', () => {
    expect(
      resolveMatchState(input({ administrationState: 'postponed' }), new Date('2028-06-10T17:00:00Z')),
    ).toBe('postponed')
  })

  it('resolves abandoned', () => {
    expect(
      resolveMatchState(input({ administrationState: 'abandoned' }), new Date('2028-06-10T19:00:00Z')),
    ).toBe('abandoned')
  })

  it('resolves cancelled', () => {
    expect(
      resolveMatchState(input({ administrationState: 'cancelled' }), new Date('2028-06-10T17:00:00Z')),
    ).toBe('cancelled')
  })
})
