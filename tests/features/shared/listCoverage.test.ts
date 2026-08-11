import { describe, expect, it } from 'vitest'
import {
  coverageNotice,
  LEAGUE_MEMBER_NOUN,
} from '../../../src/features/shared/listCoverage'

/**
 * Contract 171's one sentence, and the two things it must never do.
 *
 * The defect it answers is not that a list is capped — the caps are deliberate
 * and have been there since contract 149. It is that a capped list beside the
 * collection's REAL size reads as "the difference did not predict", which is a
 * statement about people that nobody made.
 */

describe('coverageNotice', () => {
  it('says nothing when the server carried everything', () => {
    // "Showing 8 of 8" is noise, and noise is how a reader learns to skip the
    // line that matters on the one occasion it appears.
    expect(
      coverageNotice({ returned: 8, total: 8, truncated: false }, LEAGUE_MEMBER_NOUN),
    ).toBeNull()
  })

  it('says nothing when the list is short for an honest reason', () => {
    // Fewer rows than members is ordinary: a read that returns only the members
    // who predicted is short by design. Truncation is the server's claim and
    // this must not manufacture one from the arithmetic.
    expect(
      coverageNotice({ returned: 3, total: 300, truncated: false }, LEAGUE_MEMBER_NOUN),
    ).toBeNull()
  })

  it('states both numbers when the server said it truncated', () => {
    const notice = coverageNotice(
      { returned: 200, total: 300, truncated: true },
      LEAGUE_MEMBER_NOUN,
    )

    expect(notice).toContain('Showing 200 of 300 league members')
  })

  it('refuses the inference the whole contract exists to prevent', () => {
    const notice = coverageNotice(
      { returned: 250, total: 412, truncated: true },
      LEAGUE_MEMBER_NOUN,
    ) as string

    // The second clause is load-bearing. Without it "Showing 250 of 412" is
    // read as "162 did not take part".
    expect(notice).toContain('that is not a record of who predicted')
  })

  it('agrees with itself for a league of one', () => {
    expect(
      coverageNotice({ returned: 1, total: 1, truncated: true }, LEAGUE_MEMBER_NOUN),
    ).toContain('1 league member.')
  })
})
