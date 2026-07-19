// Dev auto-login POLICY — the single place that decides whether the app should
// silently sign in as the seeded dev user on startup (docs/auth-plan.md §1).
//
// This module is deliberately dependency-free: it does NOT import the Supabase
// client, so the fail-closed rule can be unit-tested in isolation with a
// fabricated environment. The decision is a pure function of the environment;
// the effects (actually signing in) live in `devAutoLogin.ts`.
//
// Together with `devAutoLogin.ts` this is the ONLY code permitted to know the
// dev user exists (CLAUDE.md rule 8). Nothing downstream may special-case it.

export interface AutoLoginEnv {
  /** import.meta.env.DEV — true under `vite dev` / tests, false in prod builds. */
  readonly DEV: boolean
  /** VITE_DEV_AUTOLOGIN — opt-in flag; "on" only when exactly the string "true". */
  readonly VITE_DEV_AUTOLOGIN?: string
  readonly VITE_DEV_USER_EMAIL?: string
  readonly VITE_DEV_USER_PASSWORD?: string
}

export type AutoLoginDecision =
  | { action: 'skip' }
  | { action: 'login'; email: string; password: string }

/**
 * Fail-closed error (docs/auth-plan.md §1 / §4): a *production* build still
 * carrying the autologin flag must refuse to start. Throwing here — with the
 * caller declining to render on rejection — is how we refuse.
 */
export class AutoLoginProductionError extends Error {
  constructor() {
    super(
      'VITE_DEV_AUTOLOGIN is enabled in a production build. The dev ' +
        'auto-login shim must never ship to production — refusing to start. ' +
        'Unset VITE_DEV_AUTOLOGIN before building (see docs/auth-plan.md).',
    )
    this.name = 'AutoLoginProductionError'
  }
}

/** The flag is on in a dev build but the dev-user credentials are incomplete. */
export class AutoLoginConfigError extends Error {
  constructor() {
    super(
      'VITE_DEV_AUTOLOGIN=true but VITE_DEV_USER_EMAIL and ' +
        'VITE_DEV_USER_PASSWORD are not both set. Fill them in .env.local ' +
        '(see .env.example and docs/auth-plan.md).',
    )
    this.name = 'AutoLoginConfigError'
  }
}

/** The flag counts as on only for the exact string "true" — nothing looser. */
export function isAutoLoginFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

/**
 * Decide what the app should do about auto-login, purely from the environment.
 * Throws (fail-closed) rather than returning when the configuration is unsafe.
 */
export function evaluateAutoLoginPolicy(env: AutoLoginEnv): AutoLoginDecision {
  const flagOn = isAutoLoginFlagOn(env.VITE_DEV_AUTOLOGIN)

  // Fail-closed: the flag on outside a dev build must halt the app entirely,
  // regardless of whether credentials are present.
  if (flagOn && !env.DEV) {
    throw new AutoLoginProductionError()
  }

  // No flag, or a normal production build: nothing to do.
  if (!flagOn || !env.DEV) {
    return { action: 'skip' }
  }

  // Dev build with the flag on: credentials are required.
  const email = env.VITE_DEV_USER_EMAIL
  const password = env.VITE_DEV_USER_PASSWORD
  if (!email || !password) {
    throw new AutoLoginConfigError()
  }

  return { action: 'login', email, password }
}
