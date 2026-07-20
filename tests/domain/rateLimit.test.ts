import { describe, it, expect } from 'vitest'
import { exceedsRateLimit, RATE_LIMITS, RATE_LIMIT_WINDOW_MS } from '../../src/domain/rateLimit'

describe('exceedsRateLimit', () => {
  const NOW = 1_000_000

  it('allows up to the limit, then blocks the next one', () => {
    const under = Array.from({ length: RATE_LIMITS.league_membership - 1 }, () => NOW - 1000)
    expect(exceedsRateLimit(under, NOW, RATE_LIMITS.league_membership)).toBe(false)

    const atLimit = Array.from({ length: RATE_LIMITS.league_membership }, () => NOW - 1000)
    expect(exceedsRateLimit(atLimit, NOW, RATE_LIMITS.league_membership)).toBe(true)
  })

  it('only counts events inside the window', () => {
    // 5 events, but all older than the window → not blocked.
    const old = Array.from({ length: 5 }, () => NOW - RATE_LIMIT_WINDOW_MS - 1)
    expect(exceedsRateLimit(old, NOW, RATE_LIMITS.league_membership)).toBe(false)

    // Boundary: exactly at the cutoff is excluded (strictly greater than cutoff).
    expect(exceedsRateLimit([NOW - RATE_LIMIT_WINDOW_MS], NOW, 1)).toBe(false)
    expect(exceedsRateLimit([NOW - RATE_LIMIT_WINDOW_MS + 1], NOW, 1)).toBe(true)
  })

  it('never blocks with no history', () => {
    expect(exceedsRateLimit([], NOW, RATE_LIMITS.prediction_save)).toBe(false)
  })

  it('prediction_save tolerates fast-but-human autosave (well under the ceiling)', () => {
    // 30 saves in the last minute (fast editing) — still allowed under 60/min.
    const saves = Array.from({ length: 30 }, (_, i) => NOW - i * 1500)
    expect(exceedsRateLimit(saves, NOW, RATE_LIMITS.prediction_save)).toBe(false)
  })
})
