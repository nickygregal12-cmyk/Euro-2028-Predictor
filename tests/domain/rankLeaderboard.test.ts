import { describe, it, expect } from 'vitest'
import { rankLeaderboard } from '../../src/domain/tournament/rankLeaderboard'

const entry = (displayName: string, totalPoints: number, isYou = false) => ({
  displayName,
  totalPoints,
  isYou,
})

describe('rankLeaderboard', () => {
  it('ranks by points desc with standard competition ranking (1, 1, 3)', () => {
    const ranked = rankLeaderboard([
      entry('Alice', 40),
      entry('Bob', 55),
      entry('Cara', 40),
    ])
    // Bob (55) first; Alice and Cara tie on 40 → both rank 2; next would be 4.
    expect(ranked.map((r) => [r.displayName, r.rank, r.tied])).toEqual([
      ['Bob', 1, false],
      ['Alice', 2, true],
      ['Cara', 2, true],
    ])
  })

  it('orders tied entries alphabetically (case-insensitive)', () => {
    const ranked = rankLeaderboard([entry('zoe', 30), entry('Amy', 30), entry('mia', 30)])
    // All tied on points but no distinct totals → pre-results (see next test).
    // Force a distinct total so ranking engages, then check the tie order.
    const withLeader = rankLeaderboard([
      entry('zoe', 30),
      entry('Amy', 30),
      entry('mia', 30),
      entry('Leader', 99),
    ])
    expect(withLeader.map((r) => r.displayName)).toEqual(['Leader', 'Amy', 'mia', 'zoe'])
    // The all-tied set has null ranks (pre-results framing).
    expect(ranked.every((r) => r.rank === null)).toBe(true)
  })

  it('returns null ranks when every entry is level (pre-results)', () => {
    const ranked = rankLeaderboard([entry('Alice', 0), entry('Bob', 0), entry('Cara', 0)])
    expect(ranked.every((r) => r.rank === null && !r.tied)).toBe(true)
    // Still ordered alphabetically for stable display.
    expect(ranked.map((r) => r.displayName)).toEqual(['Alice', 'Bob', 'Cara'])
  })

  it('preserves the isYou flag', () => {
    const ranked = rankLeaderboard([entry('Alice', 10), entry('You', 20, true)])
    expect(ranked.find((r) => r.isYou)?.displayName).toBe('You')
  })
})
