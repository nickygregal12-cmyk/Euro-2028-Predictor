import { describe, it, expect } from 'vitest'
import {
  DISPLAY_NAME_MAX,
  PASSWORD_MIN,
  emailError,
  hasErrors,
  hasNewPasswordErrors,
  validateNewPassword,
  validateSignUp,
} from '../../../src/features/auth/authValidation'

// Proves the sign-up field checks mirror the server constraints
// (docs/auth-plan.md §3): display name required + length-limited, valid email,
// minimum password length.

describe('validateSignUp', () => {
  const ok = { displayName: 'Alex', email: 'alex@example.com', password: 'secret1' }

  it('passes a valid entry', () => {
    const errors = validateSignUp(ok)
    expect(hasErrors(errors)).toBe(false)
  })

  it('requires a display name', () => {
    expect(validateSignUp({ ...ok, displayName: '   ' }).displayName).toBeDefined()
  })

  it('rejects a display name over the length limit', () => {
    const long = 'x'.repeat(DISPLAY_NAME_MAX + 1)
    expect(validateSignUp({ ...ok, displayName: long }).displayName).toContain(
      String(DISPLAY_NAME_MAX),
    )
  })

  it('accepts a display name exactly at the limit', () => {
    const exact = 'x'.repeat(DISPLAY_NAME_MAX)
    expect(validateSignUp({ ...ok, displayName: exact }).displayName).toBeUndefined()
  })

  it('flags a missing or malformed email', () => {
    expect(validateSignUp({ ...ok, email: '' }).email).toBeDefined()
    expect(validateSignUp({ ...ok, email: 'not-an-email' }).email).toBeDefined()
  })

  it('enforces the minimum password length', () => {
    const short = 'x'.repeat(PASSWORD_MIN - 1)
    expect(validateSignUp({ ...ok, password: short }).password).toBeDefined()
    expect(validateSignUp({ ...ok, password: 'x'.repeat(PASSWORD_MIN) }).password).toBeUndefined()
  })

  it('reports every problem at once', () => {
    const errors = validateSignUp({ displayName: '', email: 'bad', password: '1' })
    expect(errors.displayName).toBeDefined()
    expect(errors.email).toBeDefined()
    expect(errors.password).toBeDefined()
  })
})

describe('emailError (shared by sign-up + reset request)', () => {
  it('accepts a valid email', () => {
    expect(emailError('alex@example.com')).toBeUndefined()
    expect(emailError('  alex@example.com  ')).toBeUndefined()
  })

  it('flags empty and malformed input distinctly', () => {
    expect(emailError('')).toBe('Please enter your email.')
    expect(emailError('   ')).toBe('Please enter your email.')
    expect(emailError('not-an-email')).toBe('Please enter a valid email address.')
  })
})

describe('validateNewPassword (reset flow)', () => {
  it('passes a long-enough, matching pair', () => {
    const errors = validateNewPassword('secret1', 'secret1')
    expect(hasNewPasswordErrors(errors)).toBe(false)
  })

  it('enforces the minimum length', () => {
    const short = 'x'.repeat(PASSWORD_MIN - 1)
    expect(validateNewPassword(short, short).password).toBeDefined()
  })

  it('flags a mismatched confirmation', () => {
    const errors = validateNewPassword('secret1', 'secret2')
    expect(errors.confirmPassword).toBeDefined()
    expect(errors.password).toBeUndefined()
  })

  it('reports both a too-short password and a mismatch at once', () => {
    const errors = validateNewPassword('1', '2')
    expect(errors.password).toBeDefined()
    expect(errors.confirmPassword).toBeDefined()
  })
})
