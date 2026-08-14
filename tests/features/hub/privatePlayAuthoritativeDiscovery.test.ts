import { describe, expect, it } from 'vitest'
import { presentPrivatePlay } from '../../../src/features/hub/privatePlayModel'
import type { PrivateCompetitionDiscovery } from '../../../src/services/supabase/privateCompetitionDiscoveryModel'

const MEMBER_LMS: PrivateCompetitionDiscovery = {
  competitionId: 'lms-private-1',
  name: 'Work LMS',
  gameKey: 'last_man_standing',
  gameName: 'Last Man Standing',
  tournamentId: 'season-1',
  seasonName: 'Premier League 2026/27',
  seasonKey: '2026-27',
  seasonKind: 'league_season',
  isOwner: false,
  membershipStatus: 'active',
  lifecycleState: 'running',
  members: 5,
  inviteCode: null,
  inviteAvailable: true,
  workspaceAvailable: true,
}

const OWNER_CUP: PrivateCompetitionDiscovery = {
  competitionId: 'cup-private-1',
  name: 'Office Championship',
  gameKey: 'predictor_cup',
  gameName: 'Predictor Championship',
  tournamentId: 'season-1',
  seasonName: 'Premier League 2026/27',
  seasonKey: '2026-27',
  seasonKind: 'league_season',
  isOwner: true,
  membershipStatus: null,
  lifecycleState: 'setup',
  members: 8,
  inviteCode: 'CUP234DEF567',
  inviteAvailable: true,
  workspaceAvailable: true,
}

describe('private-play authoritative bonus-container discovery', () => {
  it('combines ordinary leagues and bonus containers without pretending they share storage', () => {
    const view = presentPrivatePlay(
      [
        {
          competitionName: 'Scottish Premiership',
          seasonLabel: '2026/27',
          gameKey: 'main_predictor',
          href: '/competitions/scottish-premiership/2026-27/leagues',
          leagues: [
            {
              id: 'ordinary-1',
              name: 'Family League',
              inviteCode: 'LEAGUE234567',
              memberCount: 12,
              isOwner: true,
              ownerName: 'You',
              lastActivityAt: null,
            },
          ],
        },
      ],
      [],
      'all',
      [MEMBER_LMS, OWNER_CUP],
    )

    expect(view.entries.map((entry) => entry.key).sort()).toEqual([
      'cup-private-1',
      'lms-private-1',
      'ordinary-1',
    ])
    expect(view.counts).toEqual({
      all: 3,
      main_predictor: 1,
      last_man_standing: 1,
      predictor_cup: 1,
    })
  })

  it('does not leak an organiser-only invite code to an ordinary member', () => {
    const view = presentPrivatePlay([], [], 'all', [MEMBER_LMS, OWNER_CUP])
    const member = view.entries.find((entry) => entry.key === 'lms-private-1')
    const owner = view.entries.find((entry) => entry.key === 'cup-private-1')

    expect(member).toMatchObject({
      inviteCode: null,
      inviteAvailable: true,
      ownerLine: 'You joined this',
      statusLine: 'In progress',
    })
    expect(owner).toMatchObject({
      inviteCode: 'CUP234DEF567',
      ownerLine: 'You own this',
      statusLine: 'Waiting to start',
    })
  })

  it('filters bonus containers by their real game key after rediscovery', () => {
    const view = presentPrivatePlay([], [], 'predictor_cup', [MEMBER_LMS, OWNER_CUP])
    expect(view.entries).toHaveLength(1)
    expect(view.entries[0]?.key).toBe('cup-private-1')
  })
})
