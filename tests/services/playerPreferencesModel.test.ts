import { describe, expect, it } from 'vitest'
import {
  EMPTY_PREFERENCES,
  favouriteTeamFor,
  isFollowing,
  mapPlayerPreferences,
  pinnedRivalsFor,
} from '../../src/services/supabase/playerPreferencesModel'

const PAYLOAD = {
  onboarding: { step: 'games', completed_at: null },
  follows: [
    {
      tournament_id: 'season-epl',
      favourite_team_id: 'team-arsenal',
      followed_at: '2026-08-01T10:00:00Z',
    },
    { tournament_id: 'season-spfl', favourite_team_id: null, followed_at: '2026-08-02T10:00:00Z' },
  ],
  pinned_rivals: [
    { tournament_id: 'season-epl', rival_user_id: 'user-sam' },
    { tournament_id: 'season-epl', rival_user_id: 'user-alex' },
  ],
}

describe('mapPlayerPreferences', () => {
  it('decodes onboarding, follows and pinned rivals as three separate answers', () => {
    const preferences = mapPlayerPreferences(PAYLOAD)

    expect(preferences.onboarding).toEqual({ step: 'games', completedAt: null })
    expect(preferences.follows).toHaveLength(2)
    expect(preferences.follows[0]).toEqual({
      tournamentId: 'season-epl',
      favouriteTeamId: 'team-arsenal',
      followedAt: '2026-08-01T10:00:00Z',
    })
    expect(preferences.pinnedRivals).toHaveLength(2)
  })

  it('follows a competition with no favourite club, because skipping is allowed', () => {
    const preferences = mapPlayerPreferences(PAYLOAD)

    expect(isFollowing(preferences, 'season-spfl')).toBe(true)
    expect(favouriteTeamFor(preferences, 'season-spfl')).toBeNull()
  })

  it('drops a follow row with no competition rather than inventing one', () => {
    const preferences = mapPlayerPreferences({
      ...PAYLOAD,
      follows: [{ favourite_team_id: 'team-arsenal' }, PAYLOAD.follows[1]],
    })

    expect(preferences.follows).toHaveLength(1)
    expect(preferences.follows[0]?.tournamentId).toBe('season-spfl')
  })

  it('drops a rival row missing either side of the pin', () => {
    const preferences = mapPlayerPreferences({
      ...PAYLOAD,
      pinned_rivals: [{ tournament_id: 'season-epl' }, { rival_user_id: 'user-sam' }],
    })

    expect(preferences.pinnedRivals).toEqual([])
  })

  it('reads an absent, null or malformed payload as the empty preference set', () => {
    for (const payload of [null, undefined, 'nonsense', [], 42]) {
      expect(mapPlayerPreferences(payload)).toEqual(EMPTY_PREFERENCES)
    }
  })

  it('reports an unstarted onboarding as null rather than as a completed one', () => {
    const preferences = mapPlayerPreferences({ onboarding: {} })

    expect(preferences.onboarding.step).toBeNull()
    expect(preferences.onboarding.completedAt).toBeNull()
  })
})

describe('preference lookups', () => {
  const preferences = mapPlayerPreferences(PAYLOAD)

  it('answers "not following" for a competition that is not in the list', () => {
    expect(isFollowing(preferences, 'season-other')).toBe(false)
    expect(favouriteTeamFor(preferences, 'season-other')).toBeNull()
  })

  it('answers "not following" for an unresolved competition rather than throwing', () => {
    expect(isFollowing(preferences, null)).toBe(false)
    expect(favouriteTeamFor(preferences, null)).toBeNull()
    expect(pinnedRivalsFor(preferences, null)).toEqual([])
  })

  it('scopes pinned rivals to one competition', () => {
    expect(pinnedRivalsFor(preferences, 'season-epl')).toEqual(['user-sam', 'user-alex'])
    expect(pinnedRivalsFor(preferences, 'season-spfl')).toEqual([])
  })
})
