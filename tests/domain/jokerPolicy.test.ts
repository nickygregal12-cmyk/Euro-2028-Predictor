import { describe, it, expect } from 'vitest'
import { isJokerCommitted, canToggleJoker } from '../../src/domain/tournament/jokerPolicy'

const NOW = new Date('2028-06-20T12:00:00Z')
const BEFORE = '2028-06-20T15:00:00Z' // kicks off later today
const AFTER = '2028-06-20T09:00:00Z' // already kicked off

describe('isJokerCommitted', () => {
  it('is not committed before kickoff', () => {
    expect(isJokerCommitted(BEFORE, NOW)).toBe(false)
  })

  it('is committed once kickoff has passed', () => {
    expect(isJokerCommitted(AFTER, NOW)).toBe(true)
  })

  it('commits exactly at kickoff (inclusive boundary)', () => {
    expect(isJokerCommitted('2028-06-20T12:00:00Z', NOW)).toBe(true)
  })

  it('is never committed when kickoff time is unknown (pre-draw)', () => {
    expect(isJokerCommitted(null, NOW)).toBe(false)
  })
})

describe('canToggleJoker — commitment boundary', () => {
  it('allows placing a joker before kickoff', () => {
    expect(
      canToggleJoker({ turningOn: true, otherJokerCount: 0, kickoffAt: BEFORE, now: NOW }),
    ).toEqual({ allowed: true })
  })

  it('rejects placing a joker after kickoff', () => {
    expect(
      canToggleJoker({ turningOn: true, otherJokerCount: 0, kickoffAt: AFTER, now: NOW }),
    ).toEqual({ allowed: false, reason: 'committed' })
  })

  it('rejects removing a committed joker after kickoff', () => {
    expect(
      canToggleJoker({ turningOn: false, otherJokerCount: 2, kickoffAt: AFTER, now: NOW }),
    ).toEqual({ allowed: false, reason: 'committed' })
  })

  it('allows moving (removing) a joker before its kickoff', () => {
    expect(
      canToggleJoker({ turningOn: false, otherJokerCount: 4, kickoffAt: BEFORE, now: NOW }),
    ).toEqual({ allowed: true })
  })
})

describe('canToggleJoker — max-5 allowance', () => {
  it('allows the fifth joker (four already placed elsewhere)', () => {
    expect(
      canToggleJoker({ turningOn: true, otherJokerCount: 4, kickoffAt: BEFORE, now: NOW }),
    ).toEqual({ allowed: true })
  })

  it('rejects a sixth joker (five already placed elsewhere)', () => {
    expect(
      canToggleJoker({ turningOn: true, otherJokerCount: 5, kickoffAt: BEFORE, now: NOW }),
    ).toEqual({ allowed: false, reason: 'max' })
  })

  it('never trips max when turning a joker off', () => {
    expect(
      canToggleJoker({ turningOn: false, otherJokerCount: 5, kickoffAt: BEFORE, now: NOW }),
    ).toEqual({ allowed: true })
  })

  it('treats the committed lock as taking precedence over max', () => {
    // At kickoff AND at the limit: committed is the reason surfaced first.
    expect(
      canToggleJoker({ turningOn: true, otherJokerCount: 5, kickoffAt: AFTER, now: NOW }),
    ).toEqual({ allowed: false, reason: 'committed' })
  })
})
