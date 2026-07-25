import { describe, expect, it } from 'vitest'
import { userFacingError } from '../../src/shared/errors/userFacingError'

describe('userFacingError', () => {
  it('maps network failures without exposing browser text', () => {
    expect(userFacingError(new TypeError('Failed to fetch internal.example'))).toBe(
      "We couldn't reach the server. Check your connection and try again.",
    )
  })

  it('maps expired sessions', () => {
    expect(userFacingError({ code: 'PGRST301', message: 'JWT expired at 2026-07-25' })).toBe(
      'Your session has expired. Please sign in again.',
    )
  })

  it('maps permission failures without exposing policies or table names', () => {
    expect(
      userFacingError({
        code: '42501',
        message: 'new row violates row-level security policy entries_insert_own',
      }),
    ).toBe("You don't have permission to do that.")
  })

  it('maps conflicts without exposing constraint names', () => {
    expect(
      userFacingError({
        code: '23505',
        message: 'duplicate key value violates unique constraint entries_user_id_tournament_id_key',
      }),
    ).toBe('This information changed elsewhere. Refresh and try again.')
  })

  it('uses only the caller-provided safe fallback for unknown failures', () => {
    const raw = 'relation public.secret_table does not exist at character 42'
    const result = userFacingError(new Error(raw), 'Could not load the league. Please try again.')
    expect(result).toBe('Could not load the league. Please try again.')
    expect(result).not.toContain('secret_table')
    expect(result).not.toContain('character 42')
  })

  it('never echoes arbitrary string errors', () => {
    expect(userFacingError('select * from auth.users')).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
