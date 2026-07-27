import { describe, expect, it } from 'vitest'
import { leagueCapacityError } from '../../../src/features/leagues/leagueErrors'

describe('league capacity errors', () => {
  it('maps the authoritative total-league cap to contact-admin copy', () => {
    expect(leagueCapacityError({ code: 'PT429' })).toBe(
      'League limit reached. Contact admin.',
    )
    expect(
      leagueCapacityError({ message: 'League limit reached. Contact admin.' }),
    ).toBe('League limit reached. Contact admin.')
  })

  it('leaves unrelated failures for the shared user-facing error boundary', () => {
    expect(leagueCapacityError(new TypeError('Failed to fetch'))).toBeNull()
    expect(leagueCapacityError({ message: 'internal table detail' })).toBeNull()
  })
})
