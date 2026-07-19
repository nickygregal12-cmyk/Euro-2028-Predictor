import { describe, it, expect } from 'vitest'
import {
  evaluateSeedPolicy,
  SeedConfigError,
  SeedProductionError,
} from '../../scripts/seed-dev/seedPolicy'

// The dev seed's fail-closed guard (mirrors the auto-login policy): a committing
// run must prove it targets a dev database, or it refuses.

const ok = {
  SEED_DEV: 'i-understand',
  SUPABASE_URL: 'https://dev-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
}

describe('evaluateSeedPolicy', () => {
  it('returns the connection when the dev acknowledgement + creds are present', () => {
    expect(evaluateSeedPolicy(ok)).toEqual({
      url: 'https://dev-project.supabase.co',
      serviceKey: 'service-role-key',
    })
  })

  it('refuses in production', () => {
    expect(() => evaluateSeedPolicy({ ...ok, NODE_ENV: 'production' })).toThrow(SeedProductionError)
  })

  it('refuses without the explicit dev acknowledgement', () => {
    expect(() => evaluateSeedPolicy({ ...ok, SEED_DEV: undefined })).toThrow(SeedConfigError)
    expect(() => evaluateSeedPolicy({ ...ok, SEED_DEV: 'yes' })).toThrow(SeedConfigError)
  })

  it('refuses without a URL or service-role key', () => {
    expect(() => evaluateSeedPolicy({ ...ok, SUPABASE_URL: undefined })).toThrow(SeedConfigError)
    expect(() => evaluateSeedPolicy({ ...ok, SUPABASE_SERVICE_ROLE_KEY: undefined })).toThrow(
      SeedConfigError,
    )
  })

  it('refuses when the target matches the known production URL', () => {
    expect(() =>
      evaluateSeedPolicy({ ...ok, SUPABASE_PROD_URL: 'https://dev-project.supabase.co' }),
    ).toThrow(SeedProductionError)
  })
})
