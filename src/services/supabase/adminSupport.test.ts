import { describe, expect, it, vi } from 'vitest'

// Decoder tests must not require a configured Supabase client. The network
// wrapper is covered separately by boundary/source tests; this suite owns only
// the bounded response shape and must run in an environment-less unit process.
vi.mock('./client', () => ({
  db: { functions: { invoke: vi.fn() } },
}))

import { decodeAdminContainers, decodeAdminSupportUsers } from './adminSupport'

describe('admin support decoders', () => {
  it('keeps the bounded user support shape and ignores malformed rows', () => {
    expect(decodeAdminSupportUsers({ users: [
      {
        supportRef: 'user-1',
        displayName: 'Alex',
        email: 'alex@example.test',
        accountStatus: 'active',
        followedCompetitions: 2,
        gameMemberships: 3,
        leagueMemberships: 4,
      },
      { displayName: 'Missing ref' },
    ] })).toEqual([
      expect.objectContaining({
        supportRef: 'user-1',
        displayName: 'Alex',
        accountStatus: 'active',
        followedCompetitions: 2,
        gameMemberships: 3,
        leagueMemberships: 4,
      }),
    ])
  })

  it('keeps invite credentials outside the container model', () => {
    const [container] = decodeAdminContainers({ containers: [{
      kind: 'league',
      id: 'league-1',
      name: 'Friends',
      seasonName: 'Premier League 2026/27',
      ownerName: 'Owner',
      memberCount: 12,
      lifecycle: 'active',
      inviteCode: 'must-not-cross-the-decoder',
    }] })

    expect(container).toEqual(expect.objectContaining({ id: 'league-1', name: 'Friends', memberCount: 12 }))
    expect(container).not.toHaveProperty('inviteCode')
  })
})
