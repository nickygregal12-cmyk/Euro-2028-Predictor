import { describe, expect, it } from 'vitest'
import {
  mapPrivateCompetitionDiscoveryPage,
  mapPrivateCupLaunchReadiness,
} from '../../src/services/supabase/privateCompetitionDiscoveryModel'

describe('private competition discovery (contract 179)', () => {
  it('keeps organiser-only invite disclosure distinct from member discovery', () => {
    const page = mapPrivateCompetitionDiscoveryPage({
      total: 2,
      returned: 2,
      has_more: false,
      competitions: [
        {
          competition_id: 'owner-cup',
          name: 'Office Championship',
          game_key: 'predictor_cup',
          game_name: 'Predictor Championship',
          tournament_id: 'season-1',
          season_name: 'Premier League 2026/27',
          season_key: '2026-27',
          season_kind: 'league_season',
          is_owner: true,
          membership_status: 'active',
          lifecycle_state: 'setup',
          members: 8,
          invite_code: 'OWNER234DEF5',
          invite_available: true,
          workspace_available: true,
        },
        {
          competition_id: 'member-lms',
          name: 'Sunday Survivors',
          game_key: 'last_man_standing',
          game_name: 'Last Man Standing',
          tournament_id: 'season-1',
          season_name: 'Premier League 2026/27',
          season_key: '2026-27',
          season_kind: 'league_season',
          is_owner: false,
          membership_status: 'active',
          lifecycle_state: 'running',
          members: 14,
          invite_code: null,
          invite_available: true,
          workspace_available: true,
        },
      ],
    })

    expect(page.total).toBe(2)
    expect(page.competitions).toHaveLength(2)
    expect(page.competitions[0]).toMatchObject({
      competitionId: 'owner-cup',
      isOwner: true,
      inviteCode: 'OWNER234DEF5',
    })
    expect(page.competitions[1]).toMatchObject({
      competitionId: 'member-lms',
      isOwner: false,
      inviteCode: null,
      inviteAvailable: true,
    })
  })

  it('drops malformed or non-private-game rows instead of guessing their identity', () => {
    const page = mapPrivateCompetitionDiscoveryPage({
      total: 3,
      returned: 3,
      has_more: true,
      competitions: [
        { competition_id: 'missing-name', game_key: 'predictor_cup', tournament_id: 's1' },
        {
          competition_id: 'wrong-game',
          name: 'Not private bonus play',
          game_key: 'main_predictor',
          tournament_id: 's1',
        },
        {
          competition_id: 'valid',
          name: 'Valid LMS',
          game_key: 'last_man_standing',
          tournament_id: 's1',
          members: 1,
        },
      ],
    })

    expect(page.hasMore).toBe(true)
    expect(page.competitions.map((entry) => entry.competitionId)).toEqual(['valid'])
  })
})

describe('private Championship launch readiness (contract 179)', () => {
  it('carries the server verdict without recomputing eligibility', () => {
    expect(
      mapPrivateCupLaunchReadiness({
        launch: {
          launched: false,
          entrants: 8,
          remaining_rounds: 12,
          format_kind: 'single_group',
          can_launch: true,
          blocked_reason: null,
        },
      }),
    ).toEqual({
      launched: false,
      entrants: 8,
      remainingRounds: 12,
      formatKind: 'single_group',
      canLaunch: true,
      blockedReason: null,
    })
  })

  it('keeps refusal reasons and returns null when the workspace names no launch question', () => {
    expect(
      mapPrivateCupLaunchReadiness({
        launch: {
          launched: false,
          entrants: 32,
          remaining_rounds: 20,
          format_kind: 'groups',
          can_launch: false,
          blocked_reason: 'field_needs_administered_draw',
        },
      }),
    ).toMatchObject({ canLaunch: false, blockedReason: 'field_needs_administered_draw' })

    expect(mapPrivateCupLaunchReadiness({ launch: null })).toBeNull()
    expect(mapPrivateCupLaunchReadiness({})).toBeNull()
  })
})
