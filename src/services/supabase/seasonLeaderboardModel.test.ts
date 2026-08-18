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

/**
 * Contract 191's identity. Three separate lines are defended here, and each one
 * has a plausible wrong implementation behind it.
 */
describe('the server owns player identity', () => {
  it('carries the reference, the reach and the identifier through unchanged', () => {
    const result = mapSeasonLeaderboardPage(
      page({
        rows: [
          row({
            playerRef: 'entry-1',
            reach: 'profile',
            playerId: 'user-1',
          }),
        ],
      }),
    )
    expect(result.rows[0]).toMatchObject({
      playerRef: 'entry-1',
      reach: 'profile',
      playerId: 'user-1',
    })
  })

  it('never reconstructs an identifier the server withheld', () => {
    // A `compare` row is a same-season entrant who shares no private league.
    // The server sends a reference and no user id; a model that filled the gap
    // in — from the reference, from the name, from anywhere — would address a
    // player the server declined to address.
    const result = mapSeasonLeaderboardPage(
      page({ rows: [row({ playerRef: 'entry-9', reach: 'compare', playerId: null })] }),
    )
    expect(result.rows[0]?.playerId).toBeNull()
    expect(result.rows[0]?.playerRef).toBe('entry-9')
  })

  it('reads a database below contract 191 as an address that does not exist', () => {
    // Not a malformed payload: it is exactly what contract 190 returns, and
    // `name-only` is the true statement about it.
    const result = mapSeasonLeaderboardPage(page())
    expect(result.rows[0]?.reach).toBe('name-only')
    expect(result.rows[0]?.playerRef).toBeNull()
    expect(result.rows[0]?.playerId).toBeNull()
  })

  it('refuses a reach it does not recognise rather than downgrading it', () => {
    // Downgrading an unknown reach to `name-only` would render a player as
    // unreachable, which is indistinguishable on screen from a permission
    // having been refused. A build that cannot interpret the server must say
    // so, not guess quietly.
    expect(() =>
      mapSeasonLeaderboardPage(page({ rows: [row({ reach: 'friends-only' })] })),
    ).toThrow(/malformed row/)
  })

  it('applies the same rules to the caller’s own row', () => {
    const result = mapSeasonLeaderboardPage(
      page({
        you: {
          ...row({ isYou: undefined }),
          playerRef: 'entry-me',
          reach: 'self',
          playerId: 'user-me',
        },
      }),
    )
    expect(result.you).toMatchObject({ playerRef: 'entry-me', reach: 'self', playerId: 'user-me' })
  })
})
