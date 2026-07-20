import { describe, it, expect } from 'vitest'
import { needsWelcome, welcomeStatusFor } from '../../../src/features/welcome/welcomeGating'

describe('needsWelcome', () => {
  it('shows the screen for a brand-new profile (welcomed_at null)', () => {
    expect(needsWelcome({ welcomedAt: null })).toBe(true)
    expect(welcomeStatusFor({ welcomedAt: null })).toBe('needed')
  })

  it('does not show it again once seen (welcomed_at set)', () => {
    const stamped = { welcomedAt: '2028-06-01T12:00:00.000Z' }
    expect(needsWelcome(stamped)).toBe(false)
    expect(welcomeStatusFor(stamped)).toBe('seen')
  })

  it('does not show it to the dev auto-login user (pre-stamped in dev-user.sql)', () => {
    // The dev user is seeded with welcomed_at already set — no dev-user
    // special-casing in code; the gate just sees a stamped profile.
    const devUser = { welcomedAt: '1970-01-01T00:00:00.000Z' }
    expect(needsWelcome(devUser)).toBe(false)
    expect(welcomeStatusFor(devUser)).toBe('seen')
  })

  it('never redirects while the profile is still loading (null profile)', () => {
    expect(needsWelcome(null)).toBe(false)
    expect(welcomeStatusFor(null)).toBe('loading')
  })
})
