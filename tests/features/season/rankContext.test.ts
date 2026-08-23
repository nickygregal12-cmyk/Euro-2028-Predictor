import { describe, expect, it } from 'vitest'
import { formatFieldSize, percentileLine } from '../../../src/features/season/rankContext'

/**
 * Rank context (`UI-F07`), and the line it must not cross.
 *
 * PERCENTILE IS DERIVABLE; MOVEMENT IS NOT. The rank and the field size are
 * both the server's, so "Top 8%" is arithmetic over authoritative numbers and
 * needs no history. "↑3 this matchweek" needs the rank the player held before,
 * which no browser read exposes (`MIG-UI-03`). These tests exist mostly to keep
 * the two apart: nothing here takes a previous rank, so nothing here can drift
 * into claiming movement.
 */

describe('percentileLine', () => {
  it('states a strong position with the scale that makes it mean something', () => {
    expect(percentileLine(384, 4812)).toBe('Top 8%')
    expect(percentileLine(1, 100)).toBe('Top 1%')
  })

  it('rounds up, so nobody is told they are in a better bracket than they are', () => {
    // 9 of 100 is 9%, not 8%.
    expect(percentileLine(9, 100)).toBe('Top 9%')
    // And rank 1 never becomes "Top 0%", a bracket nobody is in.
    expect(percentileLine(1, 4812)).toBe('Top 1%')
  })

  it('says nothing below halfway rather than flattering the player', () => {
    // "Top 96%" is a euphemism. The rank and the field size are already on
    // screen; framing only the good half is not being straight.
    expect(percentileLine(96, 100)).toBeNull()
    expect(percentileLine(51, 100)).toBeNull()
    expect(percentileLine(50, 100)).toBe('Top 50%')
  })

  it('says nothing for a field too small for a percentile to be context', () => {
    // In a league of eight, "top 25%" is second place said less clearly.
    expect(percentileLine(2, 8)).toBeNull()
    expect(percentileLine(2, 49)).toBeNull()
    expect(percentileLine(2, 50)).toBe('Top 4%')
    // Literals, deliberately. Writing these as `MIN_FIELD_FOR_PERCENTILE - 1`
    // and `MIN_FIELD_FOR_PERCENTILE` made the assertion agree with the constant
    // by construction, so it could report a CHANGE to the threshold but never
    // that the threshold was wrong — which is how it sat at 25 while
    // `docs/design-system.md` said 50. The rule's own number is asserted
    // against the document in `tests/documentation/smallNumbersHonesty.test.ts`.
  })

  it('refuses anything it cannot compute honestly', () => {
    expect(percentileLine(null, 100)).toBeNull()
    expect(percentileLine(5, null)).toBeNull()
    expect(percentileLine(0, 100)).toBeNull()
    // A rank beyond the field is a disagreement between two server numbers, and
    // guessing which is right would be worse than saying nothing.
    expect(percentileLine(101, 100)).toBeNull()
    expect(percentileLine(Number.NaN, 100)).toBeNull()
  })
})

describe('formatFieldSize', () => {
  it('renders a large field the way a player reads one', () => {
    expect(formatFieldSize(4812)).toBe((4812).toLocaleString())
    expect(formatFieldSize(8)).toBe('8')
  })
})
