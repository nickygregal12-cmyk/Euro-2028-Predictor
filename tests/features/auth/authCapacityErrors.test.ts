import { describe, expect, it } from 'vitest'
import { friendlyAuthError } from '../../../src/features/auth/authErrors'

describe('signup capacity errors', () => {
  it('maps a confirmed capacity rejection to contact-admin copy', () => {
    expect(friendlyAuthError({ code: 'PT429' }, 'signup')).toBe(
      'Registration is currently full. Contact admin.',
    )
    expect(
      friendlyAuthError(
        { message: 'Public registration is currently full. Contact admin.' },
        'signup',
      ),
    ).toBe('Registration is currently full. Contact admin.')
  })

  it('maps Supabase-wrapped trigger failures without exposing internals', () => {
    expect(
      friendlyAuthError(
        { code: 'unexpected_failure', message: 'Database error saving new user' },
        'signup',
      ),
    ).toBe("We couldn't complete registration. Contact admin.")
  })

  it('does not mislabel the same custom code on unrelated auth actions', () => {
    expect(friendlyAuthError({ code: 'PT429' }, 'login')).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
