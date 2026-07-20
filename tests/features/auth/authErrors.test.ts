import { describe, it, expect } from 'vitest'
import { friendlyAuthError } from '../../../src/features/auth/authErrors'

// Proves the friendly-error mapping from docs/auth-plan.md §3: a raw Supabase
// error must never reach the user; each known failure gets human copy.

describe('friendlyAuthError', () => {
  it('maps invalid credentials on login to a friendly message', () => {
    const byCode = friendlyAuthError({ code: 'invalid_credentials', status: 400 }, 'login')
    const byMessage = friendlyAuthError({ message: 'Invalid login credentials' }, 'login')
    expect(byCode).toBe("That email or password isn't right. Please try again.")
    expect(byMessage).toBe(byCode)
  })

  it('maps an existing account on sign-up to a "log in instead" message', () => {
    const byCode = friendlyAuthError({ code: 'user_already_exists', status: 422 }, 'signup')
    const byMessage = friendlyAuthError({ message: 'User already registered' }, 'signup')
    const expected = 'An account with this email already exists. Try logging in instead.'
    expect(byCode).toBe(expected)
    expect(byMessage).toBe(expected)
  })

  it('maps a dropped connection (fetch TypeError) to the network message', () => {
    const network = "We couldn't reach the server. Check your connection and try again."
    expect(friendlyAuthError(new TypeError('Failed to fetch'), 'login')).toBe(network)
    expect(friendlyAuthError({ message: 'NetworkError when attempting to fetch' }, 'signup')).toBe(
      network,
    )
  })

  it('maps a weak password to guidance', () => {
    expect(
      friendlyAuthError({ code: 'weak_password', message: 'Password should be at least 6' }, 'signup'),
    ).toBe('Please choose a longer password (at least 6 characters).')
  })

  it('maps rate limiting (429) to a wait message', () => {
    expect(friendlyAuthError({ status: 429 }, 'login')).toBe(
      'Too many attempts. Please wait a moment and try again.',
    )
  })

  it('never leaks a raw message for an unknown error, and tailors the fallback', () => {
    const weird = { message: 'pg: relation "foo" does not exist' }
    const login = friendlyAuthError(weird, 'login')
    const signup = friendlyAuthError(weird, 'signup')
    expect(login).toBe('Something went wrong. Please try again.')
    expect(signup).not.toContain('relation')
    expect(signup).toContain('Something went wrong')
  })

  it('handles non-object throws without crashing', () => {
    expect(friendlyAuthError(undefined, 'login')).toBe('Something went wrong. Please try again.')
    expect(friendlyAuthError('boom', 'login')).toBe('Something went wrong. Please try again.')
  })

  // Password-reset flow.
  it('maps a weak new password on the update action to the same guidance', () => {
    expect(
      friendlyAuthError({ code: 'weak_password' }, 'update'),
    ).toBe('Please choose a longer password (at least 6 characters).')
  })

  it('maps reusing the same password to a "must be different" message', () => {
    expect(friendlyAuthError({ code: 'same_password' }, 'update')).toBe(
      'Your new password must be different from your current one.',
    )
    expect(
      friendlyAuthError({ message: 'New password should be different from the old password.' }, 'update'),
    ).toBe('Your new password must be different from your current one.')
  })

  it('maps a missing recovery session (expired link) to request-a-new-one copy', () => {
    const expected = 'Your reset link has expired or was already used. Please request a new one.'
    expect(friendlyAuthError({ code: 'session_not_found' }, 'update')).toBe(expected)
    expect(friendlyAuthError({ name: 'AuthSessionMissingError' }, 'update')).toBe(expected)
    // The same shape on other actions falls through to generic (not applicable).
    expect(friendlyAuthError({ code: 'session_not_found' }, 'login')).toBe(
      'Something went wrong. Please try again.',
    )
  })

  it('keeps a reset request neutral: an unknown failure never leaks or guesses', () => {
    const reset = friendlyAuthError({ message: 'opaque recover failure' }, 'reset')
    expect(reset).toBe('Something went wrong. Please try again.')
    // Network + rate-limit still map on the reset action.
    expect(friendlyAuthError(new TypeError('Failed to fetch'), 'reset')).toContain('connection')
    expect(friendlyAuthError({ status: 429 }, 'reset')).toContain('Too many attempts')
  })

  // Item 2 (incident follow-up): a no-session / RLS-rejection failure must NOT be
  // mislabelled as "email may already be in use" — it gets its own accurate copy,
  // distinct from the genuine email-in-use case.
  it('distinguishes a no-session / RLS failure from email-in-use', () => {
    const setupCopy = "We couldn't finish setting up your account. Please try again."
    expect(friendlyAuthError({ code: '42501' }, 'signup')).toBe(setupCopy)
    expect(
      friendlyAuthError({ message: 'new row violates row-level security policy for table "profiles"' }, 'signup'),
    ).toBe(setupCopy)
    expect(friendlyAuthError({ code: 'insufficient_privilege' }, 'signup')).toBe(setupCopy)
    // ...and it is genuinely different from the email-in-use message.
    expect(setupCopy).not.toBe(
      friendlyAuthError({ code: 'email_exists' }, 'signup'),
    )
  })

  it('never guesses "email may already be in use" on an unknown sign-up failure', () => {
    const signup = friendlyAuthError({ message: 'some opaque backend failure' }, 'signup')
    expect(signup.toLowerCase()).not.toContain('already')
    expect(signup.toLowerCase()).not.toContain('in use')
    expect(signup).toBe('Something went wrong. Please try again.')
  })
})
