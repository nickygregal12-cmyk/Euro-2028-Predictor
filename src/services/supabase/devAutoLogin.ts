// Dev auto-login SHIM (docs/auth-plan.md §1).
//
// Auth screens are deferred, but the auth *plumbing* is live from day one: in a
// dev build with VITE_DEV_AUTOLOGIN=true, the app silently signs in as the
// seeded dev user on startup, so sessions, auth.uid() and RLS behave exactly as
// they will in production. Building real auth later is then only screen work.
//
// This file plus `autoLoginPolicy.ts` are the ONLY code allowed to know the dev
// user exists (CLAUDE.md rule 8). Callers invoke `initDevAuth()` and never touch
// the dev-user credentials themselves.

import { supabase } from './client'
import {
  evaluateAutoLoginPolicy,
  AutoLoginProductionError,
  type AutoLoginEnv,
} from './autoLoginPolicy'

function readEnv(): AutoLoginEnv {
  return {
    DEV: import.meta.env.DEV,
    VITE_DEV_AUTOLOGIN: import.meta.env.VITE_DEV_AUTOLOGIN,
    VITE_DEV_USER_EMAIL: import.meta.env.VITE_DEV_USER_EMAIL,
    VITE_DEV_USER_PASSWORD: import.meta.env.VITE_DEV_USER_PASSWORD,
  }
}

/**
 * Apply the dev auto-login policy at app startup.
 *
 * - Production build with the flag on → throws `AutoLoginProductionError`; the
 *   caller must let it propagate so the app refuses to start (fail-closed).
 * - Dev build with the flag on → signs in as the seeded dev user (an existing
 *   session is reused; a sign-in failure is logged, not fatal, so development
 *   isn't blocked before the dev user has been seeded).
 * - Anything else → no-op (no network calls in a normal production build).
 */
export async function initDevAuth(): Promise<void> {
  const decision = evaluateAutoLoginPolicy(readEnv()) // may throw (fail-closed)
  if (decision.action === 'skip') return

  // Reuse an existing session (e.g. after an HMR reload) instead of re-signing.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session) return

  const { error } = await supabase.auth.signInWithPassword({
    email: decision.email,
    password: decision.password,
  })

  if (error) {
    // Non-fatal in dev: most likely the dev user hasn't been created yet.
    // Let the app render logged-out rather than blocking development.
    console.error(
      '[dev auto-login] sign-in failed — has the dev user been seeded? ' +
        'See supabase/dev-user.sql and docs/auth-plan.md.',
      error.message,
    )
    return
  }

  console.info('[dev auto-login] signed in as the seeded dev user.')
}

export { AutoLoginProductionError }
