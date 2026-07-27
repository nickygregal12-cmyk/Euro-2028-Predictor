import { describe, expect, it } from 'vitest'
import { friendlyLeagueError } from '../../../src/features/leagues/leagueErrors'

describe('league errors', () => {
  it('maps the authoritative total-league cap to contact-admin copy', () => {
    expect(friendlyLeagueError({ code: 'PT429' })).toBe(
      'League limit reached. Contact admin.',
    )
    expect(
      friendlyLeagueError({ message: 'League limit reached. Contact admin.' }),
    ).toBe('League limit reached. Contact admin.')
  })

  it('uses safe existing infrastructure mappings for other failures', () => {
    expect(friendlyLeagueError(new TypeError('Failed to fetch'))).toContain(
      "couldn't reach the server",
    )
    expect(friendlyLeagueError({ message: 'internal table detail' })).toBe(
      'Could not create the league. Try again.',
    )
  })
})
