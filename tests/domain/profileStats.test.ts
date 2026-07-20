import { describe, it, expect } from 'vitest'
import { profileStats, profileVisibility } from '../../src/domain/tournament/profileStats'

describe('profileStats', () => {
  it('is all-zero with a dash accuracy when nothing is scored (new user)', () => {
    expect(profileStats([])).toEqual({
      exactScores: 0,
      correctResults: 0,
      scoredMatches: 0,
      accuracyPercent: null,
    })
  })

  it('counts exact and correct, and computes accuracy over scored matches', () => {
    const s = profileStats(['exact', 'correct', 'wrong', 'exact'])
    expect(s.exactScores).toBe(2)
    expect(s.correctResults).toBe(1)
    expect(s.scoredMatches).toBe(4)
    expect(s.accuracyPercent).toBe(75) // 3 of 4 right
  })

  it('is 100% when every outcome was right, 0% when all wrong', () => {
    expect(profileStats(['exact', 'correct']).accuracyPercent).toBe(100)
    expect(profileStats(['wrong', 'wrong']).accuracyPercent).toBe(0)
  })

  it('rounds accuracy to a whole percent', () => {
    // 1 of 3 right → 33.33% → 33
    expect(profileStats(['exact', 'wrong', 'wrong']).accuracyPercent).toBe(33)
  })
})

describe('profileVisibility (reveal rule)', () => {
  it('always shows your own profile in full, lock or not', () => {
    expect(profileVisibility({ isOwn: true, locked: false })).toBe('full')
    expect(profileVisibility({ isOwn: true, locked: true })).toBe('full')
  })

  it("hides another player's profile pre-lock, reveals it post-lock", () => {
    expect(profileVisibility({ isOwn: false, locked: false })).toBe('hidden')
    expect(profileVisibility({ isOwn: false, locked: true })).toBe('full')
  })
})
