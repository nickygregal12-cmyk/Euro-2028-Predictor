// Pure rate-limit rule, unit-testable and MIRRORED by the SQL enforce_rate_limit
// (20260720210000_rate_limits.sql), which is the real server-side gate. Data in
// (recent action timestamps), boolean out. No React, no DB.

export const RATE_LIMIT_WINDOW_MS = 60_000 // one minute

// Per-user, per-minute ceilings. Justification:
//   prediction_save (60/min ≈ 1/s): the group-predictor autosave is already
//     debounced, so even fast thumb-typing across all 36 scores stays well under
//     this; 60/min only trips a runaway loop or a scripted hammer. Abuse here is
//     self-scoped (RLS limits writes to the user's own entry), so the ceiling is
//     generous by design.
//   league_membership (5/min): joining/creating leagues is a discrete action a
//     real user does a handful of times; 5/min stops join-spam and invite-code
//     probing while never bothering normal use.
export const RATE_LIMITS = {
  prediction_save: 60,
  league_membership: 5,
} as const

export type RateLimitedAction = keyof typeof RATE_LIMITS

/**
 * Whether an action should be BLOCKED now: true when the number of prior events
 * within the window is already at/above `max` (mirrors the SQL `count(...) >=
 * max` guard, checked before logging the new event).
 */
export function exceedsRateLimit(
  recentMs: number[],
  nowMs: number,
  max: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): boolean {
  const cutoff = nowMs - windowMs
  const inWindow = recentMs.reduce((n, t) => (t > cutoff ? n + 1 : n), 0)
  return inWindow >= max
}
