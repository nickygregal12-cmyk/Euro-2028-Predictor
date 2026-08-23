import { describe, expect, it } from 'vitest'
import { mapPrivateCompetitionWorkspace } from '../../src/services/supabase/privateCompetitionWorkspaceModel'

describe('private competition workspace (contract 179)', () => {
  it('preserves caller membership, private round identity and concealed pick facts', () => {
    const workspace = mapPrivateCompetitionWorkspace({
      competition: {
        id: 'private-lms-1',
        name: 'Friday Survivors',
        game_key: 'last_man_standing',
        game_name: 'Last Man Standing',
        tournament_id: 'season-1',
        season_name: 'Scottish Premiership 2026/27',
        season_key: '2026-27',
        lifecycle_state: 'running',
      },
      caller: {
        is_owner: true,
        membership_status: 'active',
        invite_code: 'PRIVATE12345',
        invite_available: true,
      },
      current_round: {
        window_id: 'window-1',
        sequence: 1,
        label: 'Matchweek 3',
        opens_at: '2026-08-20T10:00:00Z',
        locks_at: '2026-08-22T14:00:00Z',
        locked: false,
      },
      member_count: 2,
      members: [
        {
          user_id: 'me',
          display_name: 'Owner',
          is_me: true,
          is_owner: true,
          outcome: 'active',
          membership_status: 'active',
          has_picked_current_round: false,
        },
        {
          user_id: 'friend',
          display_name: 'Friend',
          is_me: false,
          is_owner: false,
          outcome: 'active',
          membership_status: 'active',
          has_picked_current_round: null,
        },
      ],
    })

    expect(workspace.competition).toMatchObject({
      id: 'private-lms-1',
      gameKey: 'last_man_standing',
      tournamentId: 'season-1',
    })
    expect(workspace.currentRound).toMatchObject({
      windowId: 'window-1',
      label: 'Matchweek 3',
      locked: false,
    })
    expect(workspace.members[0]?.hasPickedCurrentRound).toBe(false)
    expect(workspace.members[1]?.hasPickedCurrentRound).toBeNull()
    expect(workspace.caller.inviteCode).toBe('PRIVATE12345')
  })

  it('fails rather than guessing an identity when the workspace is malformed', () => {
    expect(() =>
      mapPrivateCompetitionWorkspace({
        competition: {
          id: 'private-lms-1',
          name: 'Missing game',
          tournament_id: 'season-1',
        },
      }),
    ).toThrow(/not in the expected shape/)
  })
})
