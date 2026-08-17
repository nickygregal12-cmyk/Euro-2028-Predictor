import { describe, expect, it } from 'vitest'
import {
  leagueStandingsRefusal,
  presentLeagueStandings,
} from '../../../src/features/season/leagueStandingsModel'
import type {
  SeasonLeagueStandingsPage,
  SeasonLeagueStandingsRow,
} from '../../../src/services/supabase/seasonLeagueStandings'

function row(overrides: Partial<SeasonLeagueStandingsRow> = {}): SeasonLeagueStandingsRow {
  return {
    userId: 'user-sam',
    displayName: 'Sam',
    points: 84,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    position: 1,
    isYou: false,
    isOwner: false,
    hasEntry: true,
    ...overrides,
  }
}

function page(overrides: Partial<SeasonLeagueStandingsPage> = {}): SeasonLeagueStandingsPage {
  return {
    rows: [row()],
    totalCount: 1,
    pageSize: 50,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...overrides,
  }
}

describe('presentLeagueStandings', () => {
  it('marks a shared rank rather than printing two identical positions', () => {
    const rows = [row({ tied: true }), row({ displayName: 'Alex', tied: true, position: 2 })]
    const view = presentLeagueStandings(page({ rows, totalCount: 2 }), rows)

    expect(view.rows.map((entry) => entry.rankLabel)).toEqual(['=1', '=1'])
    // Position, not rank, keys the rows: ranks repeat on a tie and would clash.
    expect(view.rows.map((entry) => entry.key)).toEqual(['row-1', 'row-2'])
  })

  it('shows a member who has not entered the game as such, never as a zero', () => {
    // They have not lost; they have not started. A "0 points from 0
    // matchweeks" row beside players who have played says something false.
    const rows = [row({ hasEntry: false, points: 0, matchweeksPlayed: 0, position: 2, rank: 2 })]
    const view = presentLeagueStandings(page({ rows, totalCount: 1 }), rows)

    expect(view.rows[0]?.notEnteredLabel).toBe('Not entered')
    expect(view.rows[0]?.points).toBeNull()
    expect(view.rows[0]?.matchweeksPlayed).toBeNull()
    expect(view.rows[0]?.accessibleSummary).toContain('has not entered this game')
    // No rank is read out either — the server ranks them last on zero, and
    // stating that would assert a standing they never took part in.
    expect(view.rows[0]?.accessibleSummary).not.toMatch(/\b2\b/)
  })

  it('accumulates pages rather than replacing them', () => {
    const first = row()
    const second = row({ displayName: 'Alex', position: 2, rank: 2 })
    const view = presentLeagueStandings(page({ rows: [second], totalCount: 2 }), [first, second])

    expect(view.rows.map((entry) => entry.displayName)).toEqual(['Sam', 'Alex'])
  })

  it('pins the caller’s row only when it is not already on screen', () => {
    const visible = [row({ isYou: true })]
    expect(presentLeagueStandings(page({ rows: visible, you: row() }), visible).pinnedYou).toBeNull()

    const others = [row({ displayName: 'Alex' })]
    const pinned = presentLeagueStandings(
      page({ rows: others, totalCount: 40, you: row({ position: 31, rank: 31 }) }),
      others,
    ).pinnedYou

    expect(pinned?.isYou).toBe(true)
    expect(pinned?.rankLabel).toBe('31')
  })

  it('states where the caller stands, in words', () => {
    const view = presentLeagueStandings(
      page({ totalCount: 8, you: row({ rank: 3, position: 3, points: 71 }) }),
      [row()],
    )

    expect(view.yourStandingLine).toBe('You are 3 of 8 on 71 points.')
  })

  it('says "joint" rather than "=" when the caller shares a rank', () => {
    const view = presentLeagueStandings(
      page({ totalCount: 8, you: row({ rank: 3, position: 4, tied: true }) }),
      [row()],
    )

    expect(view.yourStandingLine).toContain('joint 3')
  })

  it('tells a caller with no entry why they are not ranked', () => {
    const view = presentLeagueStandings(
      page({ totalCount: 8, you: row({ hasEntry: false, points: 0, matchweeksPlayed: 0 }) }),
      [row()],
    )

    expect(view.yourStandingLine).toMatch(/not entered this game/)
  })

  it('has no standing line at all when the payload carried no `you`', () => {
    expect(presentLeagueStandings(page({ you: null }), [row()]).yourStandingLine).toBeNull()
  })

  it('counts members in the caption, singular and plural', () => {
    expect(presentLeagueStandings(page({ totalCount: 1 }), [row()]).captionLine).toMatch(
      /^1 member,/,
    )
    expect(presentLeagueStandings(page({ totalCount: 8 }), [row()]).captionLine).toMatch(
      /^8 members,/,
    )
  })

  it('carries the server’s cursor through untouched', () => {
    const view = presentLeagueStandings(
      page({ hasMore: true, nextCursor: 'cafe01' }),
      [row()],
    )

    expect(view.hasMore).toBe(true)
    expect(view.nextCursor).toBe('cafe01')
  })

  it('names the owner in the accessible sentence', () => {
    const rows = [row({ isOwner: true })]
    const view = presentLeagueStandings(page({ rows }), rows)

    expect(view.rows[0]?.accessibleSummary).toContain('league owner')
  })
})

describe('leagueStandingsRefusal', () => {
  it.each([
    ['insufficient_privilege', /no longer a member/],
    ['42501', /no longer a member/],
    ['check_violation', /belongs to a tournament/],
    ['23514', /belongs to a tournament/],
    ['no_data_found', /no longer exists/],
    ['02000', /no longer exists/],
    ['22023', /lost our place/],
  ])('explains %s in its own words', (code, expected) => {
    expect(leagueStandingsRefusal({ code })).toMatch(expected)
  })

  it('never passes a server message through to a player', () => {
    expect(leagueStandingsRefusal({ code: '42501', message: 'permission denied for table' })).toBe(
      'You are no longer a member of this league.',
    )
  })

  it('degrades an unknown code to safe generic copy', () => {
    expect(leagueStandingsRefusal({ code: 'XX999' })).toMatch(/went wrong/)
    expect(leagueStandingsRefusal(new Error('offline'))).toMatch(/went wrong|reach the server/)
  })
})


/**
 * The gap to the people you play with — the "how am I doing against them"
 * half of the owner's Player & League Insights pillar, derived from rows
 * already on screen rather than from a new read.
 *
 * Every case here is a case where a naive subtraction would say something
 * false, which is why each has a test rather than a comment.
 */
describe('presentLeagueStandings — the gap to a rival', () => {
  function league(rows: SeasonLeagueStandingsRow[], you: SeasonLeagueStandingsRow) {
    return presentLeagueStandings(
      page({ rows, totalCount: rows.length, you }),
      rows,
    )
  }

  it('names the member immediately above and the leader when they differ', () => {
    const priya = row({ userId: 'u-priya', displayName: 'Priya', rank: 1, points: 52, position: 1 })
    const jamie = row({ userId: 'u-jamie', displayName: 'Jamie', rank: 2, points: 44, position: 2 })
    const you = row({
      userId: 'u-you',
      displayName: 'You',
      rank: 3,
      points: 38,
      position: 3,
      isYou: true,
    })

    expect(league([priya, jamie, you], you).yourGapLine).toBe(
      '6 points behind Jamie. 14 behind Priya.',
    )
  })

  it('says the leader once when the leader is the member above', () => {
    const jamie = row({ userId: 'u-jamie', displayName: 'Jamie', rank: 1, points: 44, position: 1 })
    const you = row({
      userId: 'u-you',
      displayName: 'You',
      rank: 2,
      points: 43,
      position: 2,
      isYou: true,
    })

    expect(league([jamie, you], you).yourGapLine).toBe('1 point behind Jamie.')
  })

  it('states a lead rather than a gap when the caller is top', () => {
    const you = row({
      userId: 'u-you',
      displayName: 'You',
      rank: 1,
      points: 50,
      position: 1,
      isYou: true,
    })
    const jamie = row({ userId: 'u-jamie', displayName: 'Jamie', rank: 2, points: 44, position: 2 })

    expect(league([you, jamie], you).yourGapLine).toBe('Leading Jamie by 6 points.')
  })

  it('distinguishes level on points from ahead', () => {
    // The server ranked them above on its own tie-break. "0 points behind" is
    // arithmetic; "level on points" is what happened.
    const jamie = row({
      userId: 'u-jamie',
      displayName: 'Jamie',
      rank: 1,
      points: 38,
      position: 1,
      tied: true,
    })
    const you = row({
      userId: 'u-you',
      displayName: 'You',
      rank: 2,
      points: 38,
      position: 2,
      isYou: true,
    })

    expect(league([jamie, you], you).yourGapLine).toBe('Level with Jamie on points.')
  })

  it('never treats a member who has not entered as a rival', () => {
    // The read ranks them last on zero so a league is not hidden from the
    // person who created it. A "you lead them by 38" sentence would be about
    // somebody who has not played.
    const you = row({
      userId: 'u-you',
      displayName: 'You',
      rank: 1,
      points: 38,
      position: 1,
      isYou: true,
    })
    const dormant = row({
      userId: 'u-chris',
      displayName: 'Chris',
      rank: 2,
      points: 0,
      matchweeksPlayed: 0,
      position: 2,
      hasEntry: false,
    })

    expect(league([you, dormant], you).yourGapLine).toBeNull()
  })

  it('falls back to the leader when the member above is on an unloaded page', () => {
    // A member deep in a long league opens page one and their own row is
    // pinned rather than listed. The member immediately above them is on a
    // page nobody fetched, so calling the leader their nearest rival would be
    // confidently wrong — the sentence becomes the one still true.
    const leader = row({ userId: 'u-a', displayName: 'Ana', rank: 1, points: 90, position: 1 })
    const you = row({
      userId: 'u-you',
      displayName: 'You',
      rank: 40,
      points: 20,
      position: 40,
      isYou: true,
    })
    const view = presentLeagueStandings(
      page({ rows: [leader], totalCount: 60, hasMore: true, you }),
      [leader],
    )

    expect(view.yourStandingLine).toBe('You are 40 of 60 on 20 points.')
    expect(view.yourGapLine).toBe('70 points behind the leader, Ana.')
  })

  it('says nothing for a member with no entry of their own', () => {
    const other = row({ userId: 'u-jamie', displayName: 'Jamie', rank: 1, points: 44 })
    const you = row({
      userId: 'u-you',
      displayName: 'You',
      rank: 2,
      points: 0,
      matchweeksPlayed: 0,
      position: 2,
      isYou: true,
      hasEntry: false,
    })

    expect(league([other, you], you).yourGapLine).toBeNull()
  })
})
