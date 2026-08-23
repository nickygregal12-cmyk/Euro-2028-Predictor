import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MIN_FIELD_FOR_PERCENTILE,
  percentileLine,
} from '../../src/features/season/rankContext'

const root = resolve(__dirname, '../..')
const designSystem = readFileSync(resolve(root, 'docs/design-system.md'), 'utf8')

/**
 * THE SMALL-NUMBERS HONESTY RULE, AND WHETHER THE CODE STILL AGREES WITH IT.
 *
 * `docs/design-system.md` §1 (decided 2026-07-22, restated in the Match Centre
 * and post-tournament sections) is a binding product rule with a number in it:
 *
 *   "Anywhere the app shows an anonymous prediction distribution or a
 *    percentile, the pool being shown must contain at least 50 players; below
 *    that, distributions collapse to participation counts only and percentiles
 *    are dropped in favour of the plain rank."
 *
 * Its rationale is privacy and dignity, not tidiness: under about fifty players
 * an "anonymous" bar is trivially de-anonymisable by league mates, and
 * "top 48%" reads as mockery.
 *
 * THE NUMBER IS READ OUT OF THE AUTHORITY, NOT COPIED BESIDE IT. A test that
 * hard-codes 50 here would be a second place for the rule to live, and the two
 * would drift exactly as the document and the code already did. Reading it means
 * the number exists once: change the document and this test changes with it;
 * change the code alone and this test fails.
 *
 * WHY NO EXISTING TEST CAUGHT THE DRIFT. `rankContext.test.ts` asserted the
 * boundary as `percentileLine(2, MIN_FIELD_FOR_PERCENTILE)` — in terms of the
 * constant under test. That goes red if somebody CHANGES the constant, but it
 * can never say the constant was wrong to begin with, because the assertion and
 * the implementation read the same number. This file exists to close that.
 */

/** The threshold as the product authority states it. */
function statedThreshold(): number {
  const match = /at least (\d+) players/.exec(designSystem)
  if (match?.[1] === undefined) {
    throw new Error(
      'The small-numbers honesty rule no longer states a player threshold in ' +
        'docs/design-system.md. If the rule was deliberately removed, delete this ' +
        'guard in the same change; do not let it pass by finding nothing.',
    )
  }
  return Number(match[1])
}

describe('the small-numbers honesty rule', () => {
  it('is still stated by the authority, as a plausible number', () => {
    const threshold = statedThreshold()
    expect(Number.isInteger(threshold)).toBe(true)
    // A guard that would accept 0 or 1 would accept the rule being gutted.
    expect(threshold).toBeGreaterThan(1)
  })

  it('is the number the code actually enforces', () => {
    // The drift this stage found: the document said 50 and the code said 25, so
    // a pool of 25-49 was shown a percentile the product forbids.
    expect(MIN_FIELD_FOR_PERCENTILE).toBe(statedThreshold())
  })

  it('drops the percentile just below the stated pool size', () => {
    const threshold = statedThreshold()
    // Rank 2 is comfortably inside the top half, so nothing but the pool size
    // can be what suppresses this.
    expect(percentileLine(2, threshold - 1)).toBeNull()
  })

  it('allows it at exactly the stated pool size', () => {
    const threshold = statedThreshold()
    expect(percentileLine(2, threshold)).not.toBeNull()
  })

  describe('the degenerate pools a private league actually produces', () => {
    // Stage 4's `sparse` seed scenario creates a one-member and a two-member
    // pool precisely so these can be reviewed rather than imagined.
    it('says nothing about a pool of one, where a percentile is a tautology', () => {
      expect(percentileLine(1, 1)).toBeNull()
    })

    it('says nothing about a pool of two, where it names the other player', () => {
      // "Top 50%" in a pool of two is "I beat you", said to two people who know
      // exactly who the other one is.
      expect(percentileLine(1, 2)).toBeNull()
      expect(percentileLine(2, 2)).toBeNull()
    })

    it('says nothing about an empty or impossible field', () => {
      expect(percentileLine(1, 0)).toBeNull()
      expect(percentileLine(0, 0)).toBeNull()
    })
  })
})
