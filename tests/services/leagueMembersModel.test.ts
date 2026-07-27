import { describe, expect, it } from 'vitest'
import {
  mapLeagueMemberPage,
  mapTransferCandidates,
} from '../../src/services/supabase/leagueMembersModel'

const member = {
  userId: '11111111-1111-1111-1111-111111111111',
  displayName: 'Alex',
  totalPoints: 42,
  rank: 1,
  tied: true,
  position: 1,
  isYou: false,
  isOwner: true,
  hasEntry: true,
  predictedCount: 36,
  joinedAt: '2026-07-27T20:00:00Z',
}

describe('private league standings response parsing', () => {
  it('maps rows, cursor and independent caller context', () => {
    expect(
      mapLeagueMemberPage({
        rows: [member],
        totalCount: 120,
        pageSize: 50,
        hasMore: true,
        nextCursor: 'opaque-cursor',
        you: {
          userId: '22222222-2222-2222-2222-222222222222',
          displayName: 'Nicky',
          totalPoints: 18,
          rank: 73,
          tied: false,
          position: 73,
          isOwner: false,
          hasEntry: true,
          predictedCount: 36,
          joinedAt: '2026-07-27T20:01:00Z',
        },
      }),
    ).toEqual({
      rows: [member],
      totalCount: 120,
      pageSize: 50,
      hasMore: true,
      nextCursor: 'opaque-cursor',
      you: {
        userId: '22222222-2222-2222-2222-222222222222',
        displayName: 'Nicky',
        totalPoints: 18,
        rank: 73,
        tied: false,
        position: 73,
        isOwner: false,
        hasEntry: true,
        predictedCount: 36,
        joinedAt: '2026-07-27T20:01:00Z',
      },
    })
  })

  it('preserves pre-results null ranks', () => {
    const page = mapLeagueMemberPage({
      rows: [{ ...member, rank: null, tied: false, isYou: true }],
      totalCount: 1,
      pageSize: 50,
      hasMore: false,
      nextCursor: null,
      you: { ...member, rank: null, tied: false, isYou: undefined },
    })

    expect(page.rows[0]?.rank).toBeNull()
    expect(page.you?.rank).toBeNull()
  })

  it('rejects a page that claims more rows without a cursor', () => {
    expect(() =>
      mapLeagueMemberPage({
        rows: [],
        totalCount: 120,
        pageSize: 50,
        hasMore: true,
        nextCursor: null,
        you: null,
      }),
    ).toThrow('League standings response was malformed.')
  })

  it('rejects malformed member and caller rows', () => {
    expect(() =>
      mapLeagueMemberPage({
        rows: [{ displayName: 'Missing fields' }],
        totalCount: 1,
        pageSize: 50,
        hasMore: false,
        nextCursor: null,
        you: null,
      }),
    ).toThrow('League standings response contained a malformed row.')

    expect(() =>
      mapLeagueMemberPage({
        rows: [],
        totalCount: 1,
        pageSize: 50,
        hasMore: false,
        nextCursor: null,
        you: { displayName: 'Missing fields' },
      }),
    ).toThrow('League standings response contained malformed caller context.')
  })
})

describe('transfer candidate parsing', () => {
  it('maps candidate rows from the owner-only search RPC', () => {
    expect(
      mapTransferCandidates([
        {
          user_id: '33333333-3333-3333-3333-333333333333',
          display_name: 'Candidate',
        },
      ]),
    ).toEqual([
      {
        userId: '33333333-3333-3333-3333-333333333333',
        displayName: 'Candidate',
      },
    ])
  })

  it('rejects malformed candidate responses', () => {
    expect(() => mapTransferCandidates(null)).toThrow(
      'Transfer candidate response was malformed.',
    )
    expect(() => mapTransferCandidates([{ display_name: 'Missing id' }])).toThrow(
      'Transfer candidate response contained a malformed row.',
    )
  })
})
