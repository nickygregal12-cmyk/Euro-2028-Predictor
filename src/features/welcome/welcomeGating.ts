// Pure gating logic for the /welcome screen (design-system §6). No React, no DB:
// data in, boolean out — so the "shown once" rule is unit-testable in isolation.

export type WelcomeStatus = 'loading' | 'needed' | 'seen'

/**
 * Whether a user should be sent to /welcome. A profile is shown the screen only
 * when it exists and has never been stamped (`welcomedAt === null`). A stamped
 * profile (a returning user, OR the dev user — which is pre-stamped in
 * supabase/dev-user.sql, so this stays free of any dev-user special-casing) is
 * not. A null profile (still loading / not created) is never "needed" — the
 * caller keeps waiting rather than flashing the screen.
 */
export function needsWelcome(profile: { welcomedAt: string | null } | null): boolean {
  if (!profile) return false
  return profile.welcomedAt === null
}

/** Map a resolved profile to the gate's tri-state (null profile ⇒ still loading). */
export function welcomeStatusFor(profile: { welcomedAt: string | null } | null): WelcomeStatus {
  if (!profile) return 'loading'
  return profile.welcomedAt === null ? 'needed' : 'seen'
}
