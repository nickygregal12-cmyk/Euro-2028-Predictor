import { describe, expect, it } from 'vitest'
import { mapPlayerProfile } from '../../src/services/supabase/playerProfileModel'

const base = {
  player_id: '11111111-1111-1111-1111-111111111111',
  display_name: 'Profile Rival',
  league_count: 2,
  has_entry: true,
  locked: false,
  lock_at: '2028-06-09T19:00:00Z',
}

describe('other-player profile response parsing', () => {
  it('maps the safe pre-lock summary without accepting hidden detail', () => {
    expect(
      mapPlayerProfile({
        ...base,
        total_points: 999,
        group_matches: [{ malformed: true }],
      }),
    ).toEqual({
      playerId: base.player_id,
      displayName: 'Profile Rival',
      leagueCount: 2,
      hasEntry: true,
      locked: false,
      lockAt: '2028-06-09T19:00:00Z',
      detail: null,
    })
  })

  it('maps bounded post-lock detail', () => {
    expect(
      mapPlayerProfile({
        ...base,
        locked: true,
        total_points: 37,
        rank: 4,
        group_matches: [
          {
            match_id: 'match-1',
            home_score: 2,
            away_score: 1,
            joker: true,
          },
        ],
        progression: [{ team_id: 'team-1', stage: 'champion' }],
        score_events: [
          {
            id: 'event-1',
            category: 'group_matches',
            points: 10,
            joker: true,
            explanation: 'Exact score with Joker',
          },
        ],
      }),
    ).toEqual({
      playerId: base.player_id,
      displayName: 'Profile Rival',
      leagueCount: 2,
      hasEntry: true,
      locked: true,
      lockAt: '2028-06-09T19:00:00Z',
      detail: {
        totalPoints: 37,
        rank: 4,
        predictions: {
          groupMatches: [
            {
              matchId: 'match-1',
              homeScore: 2,
              awayScore: 1,
              joker: true,
            },
          ],
          progression: [{ teamId: 'team-1', stage: 'CHAMPION' }],
        },
        events: [
          {
            id: 'event-1',
            category: 'group_matches',
            points: 10,
            joker: true,
            explanation: 'Exact score with Joker',
          },
        ],
      },
    })
  })

  it('maps the post-lock no-entry state without requiring detail', () => {
    expect(
      mapPlayerProfile({
        ...base,
        has_entry: false,
        locked: true,
      }),
    ).toMatchObject({
      hasEntry: false,
      locked: true,
      detail: null,
    })
  })

  it('rejects malformed and over-limit detail rather than truncating it', () => {
    expect(() => mapPlayerProfile({ ...base, league_count: -1 })).toThrow(
      'Player profile response was malformed.',
    )

    expect(() =>
      mapPlayerProfile({
        ...base,
        locked: true,
        total_points: 1,
        rank: 1,
        group_matches: Array.from({ length: 37 }, (_, index) => ({
          match_id: `match-${index}`,
          home_score: 1,
          away_score: 0,
          joker: false,
        })),
        progression: [],
        score_events: [],
      }),
    ).toThrow('Player profile group predictions were malformed.')

    expect(() =>
      mapPlayerProfile({
        ...base,
        locked: true,
        total_points: 1,
        rank: 1,
        group_matches: [],
        progression: [{ team_id: 'team-1', stage: 'unknown' }],
        score_events: [],
      }),
    ).toThrow('Player profile contained malformed progression.')
  })
})
