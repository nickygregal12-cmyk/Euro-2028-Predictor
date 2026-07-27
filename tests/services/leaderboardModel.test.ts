import { describe, expect, it } from 'vitest'
import { mapLeaderboardPage } from '../../src/services/supabase/leaderboardModel'

describe('bounded leaderboard response parsing', () => {
  it('maps rows, cursor and current-user context', () => {
    expect(
      mapLeaderboardPage({
        rows: [
          {
            displayName: 'Alex',
            totalPoints: 42,
            rank: 1,
            tied: true,
            position: 1,
            isYou: false,
          },
        ],
        totalCount: 120,
        pageSize: 50,
        hasMore: true,
        nextCursor: 'opaque-cursor',
        you: {
          displayName: 'Nicky',
          totalPoints: 18,
          rank: 73,
          tied: false,
          position: 73,
        },
      }),
    ).toEqual({
      rows: [
        {
          displayName: 'Alex',
          totalPoints: 42,
          rank: 1,
          tied: true,
          position: 1,
          isYou: false,
        },
      ],
      totalCount: 120,
      pageSize: 50,
      hasMore: true,
      nextCursor: 'opaque-cursor',
      you: {
        displayName: 'Nicky',
        totalPoints: 18,
        rank: 73,
        tied: false,
        position: 73,
      },
    })
  })

  it('preserves pre-results null ranks', () => {
    const page = mapLeaderboardPage({
      rows: [
        {
          displayName: 'Player',
          totalPoints: 0,
          rank: null,
          tied: false,
          position: 1,
          isYou: true,
        },
      ],
      totalCount: 1,
      pageSize: 50,
      hasMore: false,
      nextCursor: null,
      you: {
        displayName: 'Player',
        totalPoints: 0,
        rank: null,
        tied: false,
        position: 1,
      },
    })

    expect(page.rows[0]?.rank).toBeNull()
    expect(page.you?.rank).toBeNull()
  })

  it('rejects a page that claims more rows without a cursor', () => {
    expect(() =>
      mapLeaderboardPage({
        rows: [],
        totalCount: 120,
        pageSize: 50,
        hasMore: true,
        nextCursor: null,
        you: null,
      }),
    ).toThrow('Leaderboard response was malformed.')
  })

  it('rejects malformed rows rather than silently dropping them', () => {
    expect(() =>
      mapLeaderboardPage({
        rows: [{ displayName: 'Missing fields' }],
        totalCount: 1,
        pageSize: 50,
        hasMore: false,
        nextCursor: null,
        you: null,
      }),
    ).toThrow('Leaderboard response contained a malformed row.')
  })
})
