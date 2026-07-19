import { describe, it, expect } from 'vitest'
import {
  DISPLAY_NAME_MAX,
  PASSWORD_MIN,
  hasErrors,
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
