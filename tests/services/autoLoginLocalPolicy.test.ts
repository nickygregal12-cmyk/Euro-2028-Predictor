import { describe, expect, it } from 'vitest'
import {
  AutoLoginProductionError,
  AutoLoginWrongProjectError,
  DEV_PROJECT_REF,
  evaluateAutoLoginPolicy,
  isLocalSupabaseUrl,
} from '../../src/services/supabase/autoLoginPolicy'

const credentials = {
  VITE_DEV_AUTOLOGIN: 'true',
  VITE_DEV_USER_EMAIL: 'e2e@euro28.local',
  VITE_DEV_USER_PASSWORD: 'local-only-password',
}

describe('local Supabase development auto-login policy', () => {
  it('allows the standard local Supabase API in a Vite development build', () => {
    expect(
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        ...credentials,
      }),
    ).toEqual({
      action: 'login',
      email: credentials.VITE_DEV_USER_EMAIL,
      password: credentials.VITE_DEV_USER_PASSWORD,
    })

    expect(isLocalSupabaseUrl('http://localhost:54321')).toBe(true)
  })

  it('continues to allow the shared development project', () => {
    expect(
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_SUPABASE_URL: `https://${DEV_PROJECT_REF}.supabase.co`,
        ...credentials,
      }).action,
    ).toBe('login')
  })

  it.each([
    'https://127.0.0.1:54321',
    'http://127.0.0.1:54322',
    'http://example.test:54321',
    'https://vkfnsqdyhvtwyqkisxhk.supabase.co',
    'not-a-url',
  ])('rejects an unapproved backend: %s', (url) => {
    expect(() =>
      evaluateAutoLoginPolicy({
        DEV: true,
        VITE_SUPABASE_URL: url,
        ...credentials,
      }),
    ).toThrow(AutoLoginWrongProjectError)
  })

  it('still refuses auto-login in a production build even for localhost', () => {
    expect(() =>
      evaluateAutoLoginPolicy({
        DEV: false,
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        ...credentials,
      }),
    ).toThrow(AutoLoginProductionError)
  })
})
