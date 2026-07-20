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
