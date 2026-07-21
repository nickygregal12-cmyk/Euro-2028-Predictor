// Fail-closed guard for the dev seed (mirrors the auto-login shim's policy in
// src/services/supabase/autoLoginPolicy.ts). A committing run must PROVE it is
// pointed at a dev database; anything ambiguous refuses. Pure and dependency-
// free so it can be unit-tested. The dry-run path never calls this — it writes
// nothing.

export class SeedProductionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedProductionError'
  }
}

export class SeedConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SeedConfigError'
  }
}

/**
 * The DEV Supabase project ref. The seed writes hostile test data and creates
 * auth users with the service-role key, so it must PROVE it targets the dev
 * project — anything else refuses, independent of SEED_DEV / NODE_ENV. This ref
 * appears in the dev project's Supabase URL (https://<ref>.supabase.co). The
 * auto-login shim pins the same ref independently
 * (src/services/supabase/autoLoginPolicy.ts) — keep the two in step.
 */
export const DEV_PROJECT_REF = 'iouzoutneyjpugbbtdem'

export type SeedEnv = {
  // Explicit acknowledgement — must equal 'i-understand' or the run refuses.
  SEED_DEV?: string
  NODE_ENV?: string
  SUPABASE_URL?: string
  // The service-role key is required to create auth users and bypass RLS.
  SUPABASE_SERVICE_ROLE_KEY?: string
  // Once a production project exists, set this to its URL; the seed then refuses
  // to run against it, belt-and-braces with SEED_DEV.
  SUPABASE_PROD_URL?: string
}

export type SeedDecision = { url: string; serviceKey: string }

/**
 * Decide whether a committing (DB-writing) seed run may proceed. Returns the
 * resolved connection on success; throws (fail-closed) otherwise:
 * - `SeedProductionError` if it looks like production (NODE_ENV, or the target
 *   URL matches SUPABASE_PROD_URL);
 * - `SeedConfigError` if the dev acknowledgement or credentials are missing.
 */
export function evaluateSeedPolicy(env: SeedEnv): SeedDecision {
  if (env.NODE_ENV === 'production') {
    throw new SeedProductionError('Refusing to seed: NODE_ENV=production.')
  }
  if (env.SEED_DEV !== 'i-understand') {
    throw new SeedConfigError(
      'Refusing to seed: set SEED_DEV=i-understand to confirm this is a DEV database.',
    )
  }
  const url = env.SUPABASE_URL?.trim()
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    throw new SeedConfigError(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (needed to create users and bypass RLS).',
    )
  }
  if (env.SUPABASE_PROD_URL && env.SUPABASE_PROD_URL.trim() === url) {
    throw new SeedProductionError(
      'Refusing to seed: SUPABASE_URL matches SUPABASE_PROD_URL. This is the production project.',
    )
  }
  // Second, independent guard: the target must PROVE it is the dev project by
  // ref, regardless of SEED_DEV / NODE_ENV / SUPABASE_PROD_URL above.
  if (!url.includes(DEV_PROJECT_REF)) {
    throw new SeedProductionError(
      `Refusing to seed: not the dev project. SUPABASE_URL must contain the ` +
        `dev project ref "${DEV_PROJECT_REF}" (got: "${url}").`,
    )
  }
  return { url, serviceKey }
}
