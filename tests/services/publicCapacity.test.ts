import { describe, expect, it } from 'vitest'
import { mapPublicCapacityRow } from '../../src/services/supabase/publicCapacityModel'

describe('public capacity parsing', () => {
  it('maps the anonymous aggregate row', () => {
    expect(
      mapPublicCapacityRow({
        public_users_used: 49,
        public_user_limit: 50,
        signup_available: true,
        leagues_used: 20,
        total_league_limit: 20,
        league_creation_available: false,
      }),
    ).toEqual({
      publicUsersUsed: 49,
      publicUserLimit: 50,
      signupAvailable: true,
      leaguesUsed: 20,
      totalLeagueLimit: 20,
      leagueCreationAvailable: false,
    })
  })

  it('rejects malformed aggregate values instead of guessing availability', () => {
    expect(() =>
      mapPublicCapacityRow({
        public_users_used: '49',
        public_user_limit: 50,
        signup_available: true,
        leagues_used: 3,
        total_league_limit: 20,
        league_creation_available: true,
      }),
    ).toThrow('invalid public user count')

    expect(() => mapPublicCapacityRow(null)).toThrow()
  })
})
