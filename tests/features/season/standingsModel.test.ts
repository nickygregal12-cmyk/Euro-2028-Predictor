import { describe, expect, it } from 'vitest'
import type {
  SeasonLeaderboardPage,
  SeasonLeaderboardRow,
} from '../../../src/services/supabase/seasonLeaderboard'
import { presentStandings } from '../../../src/features/season/standingsModel'

/**
 * The season standings presentation model.
 *
 * The assertions that matter here are the ones holding a line the interface
 * could quietly cross. Ranking, ordering and tie resolution belong to the
 * server (ADR 0011/0012 and the `get_season_leaderboard` contract), so the
 * model must present what it is given and never recompute it — a browser that
 * re-sorted or re-ranked would be a second standings authority, and the two
 * would disagree the first time a settlement landed mid-page.
 *
 * The other line is ADR 0012's pairing of points with matchweeks played. A
 * total shown alone flatters whoever joined earliest, so every row carries the
 * count, including in the sentence assistive technology receives.
 */

function row(over: Partial<SeasonLeaderboardRow> = {}): SeasonLeaderboardRow {
  return {
    displayName: 'Ada',
    points: 84,
    rank: 1,
    matchweeksPlayed: 22,
    tied: false,
    position: 1,
    isYou: false,
    // Contract 191's identity. Present on every row the server produces, so a
    // builder that omitted it would let the model be exercised against a shape
    // the database cannot return.
    playerRef: 'entry-ada',
    reach: 'compare',
    playerId: null,
    ...over,
  }
}

function page(over: Partial<SeasonLeaderboardPage> = {}): SeasonLeaderboardPage {
  return {
    rows: [row()],
    totalCount: 1,
    pageSize: 25,
    hasMore: false,
    nextCursor: null,
    you: null,
    ...over,
  }
}

describe('the season standings model', () => {
  it('preserves the server ordering exactly as received', () => {
    // Deliberately out of rank order: if the model sorts, this fails. The
    // server decides the ordering, including any tie-break the browser has no
    // way to know about.
    const rows = [
      row({ displayName: 'Cleo', rank: 3, position: 3, points: 70 }),
      row({ displayName: 'Ada', rank: 1, position: 1, points: 84 }),
      row({ displayName: 'Bo', rank: 2, position: 2, points: 77 }),
    ]
    const view = presentStandings(page({ rows, totalCount: 3 }), rows)
    expect(view.rows.map((entry) => entry.displayName)).toEqual(['Cleo', 'Ada', 'Bo'])
  })

  it('marks a shared rank without changing the number', () => {
    const rows = [
      row({ displayName: 'Ada', rank: 4, position: 4, tied: true }),
      row({ displayName: 'Bo', rank: 4, position: 5, tied: true }),
      row({ displayName: 'Cleo', rank: 6, position: 6, tied: false }),
    ]
    const view = presentStandings(page({ rows, totalCount: 3 }), rows)
    expect(view.rows.map((entry) => entry.rankLabel)).toEqual(['=4', '=4', '6'])
    // The rank itself is untouched — only its presentation says "shared".
    expect(view.rows.map((entry) => entry.rank)).toEqual([4, 4, 6])
  })

  it('keys rows by position so a tie does not collide', () => {
    const rows = [
      row({ displayName: 'Ada', rank: 4, position: 4, tied: true }),
      row({ displayName: 'Bo', rank: 4, position: 5, tied: true }),
    ]
    const view = presentStandings(page({ rows, totalCount: 2 }), rows)
    expect(new Set(view.rows.map((entry) => entry.key)).size).toBe(2)
  })

  it('carries matchweeks played into the accessible sentence', () => {
    const rows = [row({ displayName: 'Ada', points: 84, matchweeksPlayed: 22 })]
    const view = presentStandings(page({ rows }), rows)
    expect(view.rows[0]?.accessibleSummary).toBe('Ada, 1, 84 points from 22 matchweeks')
  })

  it('says "joint" rather than "=" to assistive technology, and singularises one matchweek', () => {
    const rows = [row({ displayName: 'Bo', rank: 4, position: 5, tied: true, matchweeksPlayed: 1 })]
    const view = presentStandings(page({ rows }), rows)
    expect(view.rows[0]?.accessibleSummary).toBe('Bo, joint 4, 84 points from 1 matchweek')
  })

  it('pins the caller when their row is outside the loaded pages', () => {
    const rows = [row({ displayName: 'Ada', position: 1 })]
    const view = presentStandings(
      page({
        rows,
        totalCount: 400,
        hasMore: true,
        nextCursor: 'server-cursor',
        you: {
          displayName: 'Zoë',
          points: 12,
          rank: 399,
          matchweeksPlayed: 4,
          tied: false,
          position: 399,
          playerRef: 'entry-zoe',
          reach: 'self',
          playerId: 'user-zoe',
        },
      }),
      rows,
    )
    expect(view.pinnedYou?.displayName).toBe('Zoë')
    expect(view.pinnedYou?.isYou).toBe(true)
    expect(view.pinnedYou?.accessibleSummary).toBe('Zoë (you), 399, 12 points from 4 matchweeks')
  })

  it('does not pin the caller when their row is already on screen', () => {
    // The row is visible, so pinning it would show the same player twice.
    const rows = [row({ displayName: 'Ada', isYou: true, position: 1 })]
    const view = presentStandings(
      page({
        rows,
        you: {
          displayName: 'Ada',
          points: 84,
          rank: 1,
          matchweeksPlayed: 22,
          tied: false,
          position: 1,
          playerRef: 'entry-ada',
          reach: 'self',
          playerId: 'user-ada',
        },
      }),
      rows,
    )
    expect(view.pinnedYou).toBeNull()
    expect(view.rows[0]?.isYou).toBe(true)
  })

  it('answers visibility against every accumulated row, not just the newest page', () => {
    // The caller appeared on page one; page two must not re-pin them.
    const loaded = [
      row({ displayName: 'Ada', isYou: true, position: 1 }),
      row({ displayName: 'Bo', position: 2 }),
    ]
    const secondPage = page({
      rows: [row({ displayName: 'Bo', position: 2 })],
      you: {
        displayName: 'Ada',
        points: 84,
        rank: 1,
        matchweeksPlayed: 22,
        tied: false,
        position: 1,
        playerRef: 'entry-ada',
        reach: 'self',
        playerId: 'user-ada',
      },
    })
    expect(presentStandings(secondPage, loaded).pinnedYou).toBeNull()
  })

  it('passes the server cursor through untouched', () => {
    const rows = [row()]
    const view = presentStandings(
      page({ rows, hasMore: true, nextCursor: 'opaque::42' }),
      rows,
    )
    expect(view.nextCursor).toBe('opaque::42')
    expect(view.hasMore).toBe(true)
  })
})
