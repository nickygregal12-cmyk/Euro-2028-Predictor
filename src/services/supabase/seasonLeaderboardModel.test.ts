import { describe, expect, it } from 'vitest'
import { mapSeasonLeaderboardPage } from './seasonLeaderboardModel'

/**
 * The first thing in `src/` that reads a season score.
 *
 * What these tests defend is not the happy path — it is the set of malformed
 * payloads that would render a PLAUSIBLE table rather than an error. A season
 * leaderboard that is wrong in a visible way gets reported; one that is wrong in
 * an invisible way becomes the thing everybody believes.
 */

const row = (over: Record<string, unknown> = {}) => ({
  displayName: 'Adam Blake',
  points: 84,
  rank: 2,
  matchweeksPlayed: 22,
  tied: false,
  position: 2,
  isYou: false,
  ...over,
})

const page = (over: Record<string, unknown> = {}) => ({
  rows: [row()],
  totalCount: 1,
  pageSize: 50,
  hasMore: false,
  nextCursor: null,
  you: null,
  ...over,
})

describe('a well-formed page', () => {
  it('parses rows, totals and the caller’s own row', () => {
    const result = mapSeasonLeaderboardPage(
      page({ you: { ...row({ isYou: true }), isYou: undefined } }),
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ points: 84, matchweeksPlayed: 22, rank: 2 })
    expect(result.you).toMatchObject({ displayName: 'Adam Blake', matchweeksPlayed: 22 })
  })

  it('accepts an absent you', () => {
    expect(mapSeasonLeaderboardPage(page()).you).toBeNull()
  })
})

describe('matches played is never defaulted', () => {
  it('rejects a row missing it, rather than rendering a season nobody played', () => {
    // ADR 0012 pairs matches played with points precisely so that equal totals
    // over different numbers of matchweeks are distinguishable. Defaulting a
    // missing value to zero would produce a complete, believable table in which
    // every player had played nothing.
    expect(() =>
      mapSeasonLeaderboardPage(page({ rows: [row({ matchweeksPlayed: undefined })] })),
    ).toThrow(/malformed row/)
  })

  it('rejects a non-integer, which is what a fractional average would arrive as', () => {
    expect(() =>
      mapSeasonLeaderboardPage(page({ rows: [row({ matchweeksPlayed: 21.5 })] })),
    ).toThrow(/malformed row/)
  })
})

describe('pagination cannot strand the caller', () => {
  it('rejects hasMore with no cursor', () => {
    // The caller would be told there is another page and given no way to ask
    // for it — a dead "load more" button rather than a visible failure.
    expect(() => mapSeasonLeaderboardPage(page({ hasMore: true, nextCursor: null }))).toThrow(
      /malformed/,
    )
  })

  it('accepts hasMore with a cursor', () => {
    const result = mapSeasonLeaderboardPage(page({ hasMore: true, nextCursor: 'abcd' }))
    expect(result.nextCursor).toBe('abcd')
  })

  it('rejects a page size below one, which would page forever', () => {
    expect(() => mapSeasonLeaderboardPage(page({ pageSize: 0 }))).toThrow(/malformed/)
  })
})

describe('a season rank is never null', () => {
  it('rejects a null rank, unlike the tournament envelope which permits one', () => {
    // The tournament leaderboard hides ranks until its standings mean anything.
    // A season table ranks from the first settled matchweek, so a null here is
    // a malformed payload rather than a legitimate "not yet".
    expect(() => mapSeasonLeaderboardPage(page({ rows: [row({ rank: null })] }))).toThrow(
      /malformed row/,
    )
  })
})

describe('structurally wrong payloads', () => {
  it.each([
    ['not an object', 42],
    ['rows missing', { totalCount: 0, pageSize: 50, hasMore: false }],
    ['rows not an array', page({ rows: {} })],
    ['negative totalCount', page({ totalCount: -1 })],
  ])('rejects %s', (_label, payload) => {
    expect(() => mapSeasonLeaderboardPage(payload)).toThrow(/malformed/)
  })
})
