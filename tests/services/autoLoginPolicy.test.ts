import { describe, it, expect } from 'vitest'
import {
  evaluateAutoLoginPolicy,
  isAutoLoginFlagOn,
  isDevProjectUrl,
  DEV_PROJECT_REF,
  AutoLoginProductionError,
  AutoLoginConfigError,
  AutoLoginWrongProjectError,
} from '../../src/services/supabase/autoLoginPolicy'

// Proves the dev auto-login policy from docs/auth-plan.md §1 — in particular the
// fail-closed rule: a production build that still carries the autologin flag
// must refuse to start, and the dev-project-ref guard (the shim may only sign
// in against the dev project).

const DEV_URL = `https://${DEV_PROJECT_REF}.supabase.co`

const creds = {
  VITE_DEV_USER_EMAIL: 'dev@euro28.local',
  VITE_DEV_USER_PASSWORD: 'dev-password',
  VITE_SUPABASE_URL: DEV_URL,
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
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_DEV_AUTOLOGIN: 'true',
        VITE_SUPABASE_URL: DEV_URL,
      }),
    ).toThrow(AutoLoginConfigError)
    expect(() =>
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_DEV_AUTOLOGIN: 'true',
        VITE_SUPABASE_URL: DEV_URL,
        VITE_DEV_USER_EMAIL: 'dev@euro28.local',
      }),
    ).toThrow(AutoLoginConfigError)
  })

  // ---- dev-project-ref guard (production Supabase split) ----

  it('logs in when the Supabase URL is the dev project', () => {
    expect(
      evaluateAutoLoginPolicy({ DEV: true, VITE_DEV_AUTOLOGIN: 'true', ...creds }),
    ).toEqual({
      action: 'login',
      email: creds.VITE_DEV_USER_EMAIL,
      password: creds.VITE_DEV_USER_PASSWORD,
    })
  })

  it('THROWS when auto-login is active but the URL is a prod-looking project', () => {
    expect(() =>
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_DEV_AUTOLOGIN: 'true',
        VITE_DEV_USER_EMAIL: 'dev@euro28.local',
        VITE_DEV_USER_PASSWORD: 'dev-password',
        VITE_SUPABASE_URL: 'https://prodprojectref123.supabase.co',
      }),
    ).toThrow(AutoLoginWrongProjectError)
  })

  it('THROWS when auto-login is active but the URL is missing (fail-closed)', () => {
    expect(() =>
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_DEV_AUTOLOGIN: 'true',
        VITE_DEV_USER_EMAIL: 'dev@euro28.local',
        VITE_DEV_USER_PASSWORD: 'dev-password',
      }),
    ).toThrow(AutoLoginWrongProjectError)
  })

  it('does NOT evaluate the URL when auto-login is inactive (prod URL is fine when the flag is off)', () => {
    expect(
      evaluateAutoLoginPolicy({
        DEV: false,
        VITE_DEV_AUTOLOGIN: 'false',
        VITE_SUPABASE_URL: 'https://prodprojectref123.supabase.co',
      }),
    ).toEqual({ action: 'skip' })
  })
})

describe('isDevProjectUrl', () => {
  it('is true only when the URL contains the dev project ref', () => {
    expect(isDevProjectUrl(DEV_URL)).toBe(true)
    expect(isDevProjectUrl(`https://${DEV_PROJECT_REF}.supabase.co`)).toBe(true)
    expect(isDevProjectUrl('https://prodprojectref123.supabase.co')).toBe(false)
    expect(isDevProjectUrl('')).toBe(false)
    expect(isDevProjectUrl(undefined)).toBe(false)
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
