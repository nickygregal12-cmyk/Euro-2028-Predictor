import { describe, it, expect } from 'vitest'
import {
  evaluateAutoLoginPolicy,
  isAutoLoginFlagOn,
  AutoLoginProductionError,
  AutoLoginConfigError,
} from '../../src/services/supabase/autoLoginPolicy'

// Proves the dev auto-login policy from docs/auth-plan.md §1 — in particular the
// fail-closed rule: a production build that still carries the autologin flag
// must refuse to start.

const creds = {
  VITE_DEV_USER_EMAIL: 'dev@euro28.local',
  VITE_DEV_USER_PASSWORD: 'dev-password',
}

describe('evaluateAutoLoginPolicy', () => {
  it('skips when the flag is unset (normal dev)', () => {
    expect(evaluateAutoLoginPolicy({ DEV: true, ...creds })).toEqual({
      action: 'skip',
    })
  })

  it('skips for any flag value other than the exact string "true"', () => {
    for (const VITE_DEV_AUTOLOGIN of ['false', '1', 'TRUE', 'yes', '']) {
      expect(
        evaluateAutoLoginPolicy({ DEV: true, VITE_DEV_AUTOLOGIN, ...creds }),
      ).toEqual({ action: 'skip' })
    }
  })

  it('logs in as the dev user in a dev build with the flag on', () => {
    expect(
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_DEV_AUTOLOGIN: 'true',
        ...creds,
      }),
    ).toEqual({
      action: 'login',
      email: creds.VITE_DEV_USER_EMAIL,
      password: creds.VITE_DEV_USER_PASSWORD,
    })
  })

  // ---- fail-closed rule (docs/auth-plan.md §1) ----

  it('THROWS in a production build when the flag is on — refuse to start', () => {
    expect(() =>
      evaluateAutoLoginPolicy({
        DEV: false,
        VITE_DEV_AUTOLOGIN: 'true',
        ...creds,
      }),
    ).toThrow(AutoLoginProductionError)
  })

  it('throws in production even if the dev credentials are absent', () => {
    expect(() =>
      evaluateAutoLoginPolicy({ DEV: false, VITE_DEV_AUTOLOGIN: 'true' }),
    ).toThrow(AutoLoginProductionError)
  })

  it('does NOT throw in production when the flag is off', () => {
    expect(
      evaluateAutoLoginPolicy({ DEV: false, VITE_DEV_AUTOLOGIN: 'false' }),
    ).toEqual({ action: 'skip' })
    expect(evaluateAutoLoginPolicy({ DEV: false })).toEqual({ action: 'skip' })
  })

  it('throws a config error when the flag is on in dev but creds are incomplete', () => {
    expect(() =>
      evaluateAutoLoginPolicy({ DEV: true, VITE_DEV_AUTOLOGIN: 'true' }),
    ).toThrow(AutoLoginConfigError)
    expect(() =>
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_DEV_AUTOLOGIN: 'true',
        VITE_DEV_USER_EMAIL: 'dev@euro28.local',
      }),
    ).toThrow(AutoLoginConfigError)
  })
})

describe('isAutoLoginFlagOn', () => {
  it('is true only for the exact string "true"', () => {
    expect(isAutoLoginFlagOn('true')).toBe(true)
    expect(isAutoLoginFlagOn('false')).toBe(false)
    expect(isAutoLoginFlagOn('1')).toBe(false)
    expect(isAutoLoginFlagOn('TRUE')).toBe(false)
    expect(isAutoLoginFlagOn(undefined)).toBe(false)
  })
})
