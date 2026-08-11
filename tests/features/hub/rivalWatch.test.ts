import { describe, expect, it } from 'vitest'
import {
  pointsSentence,
  presentRivalWatch,
} from '../../../src/features/hub/rivalWatchModel'
import type { SeasonLeagueStandingsRow } from '../../../src/services/supabase/seasonLeagueStandingsModel'

/**
 * Rival Watch (`MIG-UI-09`, contract 157).
 *
 * WHAT THESE PIN. That the comparison is a subtraction of two numbers already on
 * screen and never a second scoring authority; that a rank difference points at
 * the right player, which is the one arithmetic error nobody would spot in a
 * screenshot; that a rival pinned in another league is skipped rather than
 * deleted; and that a caller with no entry is told so rather than compared
 * against zero.
 */

function row(overrides: Partial<SeasonLeagueStandingsRow>): SeasonLeagueStandingsRow {
  return {
    userId: 'user-x',
    displayName: 'X',
    points: 0,
    rank: 1,
    matchweeksPlayed: 10,
    tied: false,
    position: 1,
    isYou: false,
    isOwner: false,
    hasEntry: true,
    ...overrides,
  }
}

const YOU = row({ userId: 'you', displayName: 'You', points: 84, rank: 2, isYou: true })
const SAM = row({ userId: 'sam', displayName: 'Sam', points: 91, rank: 1 })
const ALEX = row({ userId: 'alex', displayName: 'Alex', points: 70, rank: 5, matchweeksPlayed: 8 })

describe('presentRivalWatch', () => {
  it('compares the caller with each pinned rival, in pin order', () => {
    const watch = presentRivalWatch([YOU, SAM, ALEX], ['alex', 'sam'])

    expect(watch.pinned.map((entry) => entry.displayName)).toEqual(['Alex', 'Sam'])
  })

  it('reports the points gap signed from the caller’s point of view', () => {
    const watch = presentRivalWatch([YOU, SAM, ALEX], ['sam', 'alex'])

    expect(watch.pinned[0]?.pointsDifference).toBe(-7)
    expect(watch.pinned[1]?.pointsDifference).toBe(14)
  })

  it('makes a positive rank difference mean the caller is ranked HIGHER', () => {
    // The one arithmetic error nobody would catch in a screenshot: rank 2
    // against rank 5 is the caller ahead, even though 2 is the smaller number.
    const watch = presentRivalWatch([YOU, ALEX], ['alex'])

    expect(watch.pinned[0]?.rankDifference).toBe(3)
    expect(watch.pinned[0]?.yourRank).toBe(2)
    expect(watch.pinned[0]?.theirRank).toBe(5)
  })

  it('flags a rival with matchweeks in hand', () => {
    const watch = presentRivalWatch([YOU, SAM, ALEX], ['sam', 'alex'])

    expect(watch.pinned[0]?.hasGamesInHand).toBe(false)
    expect(watch.pinned[1]?.hasGamesInHand).toBe(true)
  })

  it('skips a rival pinned in another league and deletes nothing', () => {
    const watch = presentRivalWatch([YOU, SAM], ['sam', 'somebody-from-another-league'])

    expect(watch.pinned).toHaveLength(1)
    expect(watch.pinned[0]?.displayName).toBe('Sam')
  })

  it('offers every other member as a candidate, and never the caller', () => {
    const watch = presentRivalWatch([YOU, SAM, ALEX], ['sam'])

    expect(watch.candidates.map((entry) => entry.userId)).toEqual(['alex'])
  })

  it('says the caller is not playing rather than comparing against zero', () => {
    const watch = presentRivalWatch([SAM, ALEX], ['sam'])

    expect(watch.youAreNotPlaying).toBe(true)
    expect(watch.pinned).toEqual([])
    // Candidates still stand: a member with no entry can still choose a rival
    // for when they do enter.
    expect(watch.candidates).toHaveLength(2)
  })
})

describe('pointsSentence', () => {
  it('names a dead heat rather than calling it zero ahead', () => {
    const watch = presentRivalWatch([YOU, row({ userId: 'tie', displayName: 'Tie', points: 84 })], [
      'tie',
    ])

    expect(pointsSentence(watch.pinned[0]!)).toBe('Level on points')
  })

  it('says ahead and behind, and gets the singular right', () => {
    const watch = presentRivalWatch(
      [YOU, SAM, row({ userId: 'one', displayName: 'One', points: 83 })],
      ['sam', 'one'],
    )

    expect(pointsSentence(watch.pinned[0]!)).toBe('7 points behind')
    expect(pointsSentence(watch.pinned[1]!)).toBe('1 point ahead')
  })
})
