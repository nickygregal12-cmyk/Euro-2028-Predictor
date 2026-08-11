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
//     real user does a handful of times; 5/min stops join-spam while never
//     bothering normal use. It used to claim it stopped "invite-code probing"
//     too, and it did not: it is enforced by a trigger on `league_members`, so
//     it fires on a SUCCESSFUL join and never on a failed one. An attacker
//     working through the keyspace was limited only on the one action they were
//     not attempting. `league_invite_probe` is that gap; the sentence is
//     corrected here rather than left standing.
//   league_invite_probe (20/min): charged by contract 152 inside
//     `get_league_preview` and `join_league`, BEFORE either looks the code up,
//     so a miss costs exactly what a hit costs. A separate budget rather than a
//     share of `league_membership`, because being invited to a league and
//     hunting for one are different activities and a shared ceiling would have
//     to either throttle real members or fund real probing. Twenty is generous
//     for someone typing a code they were sent and getting it wrong twice, and
//     ruinous for anything scripted.
export const RATE_LIMITS = {
  prediction_save: 60,
  league_membership: 5,
  league_invite_probe: 20,
} as const

export type RateLimitedAction = keyof typeof RATE_LIMITS

/**
 * Whether an action should be BLOCKED now: true when the number of prior events
 * within the window is already at/above `max` (mirrors the SQL `count(...) >=
 * max` guard, checked before logging the new event).
 *
 * This is the rule, not the enforcement. The rule only holds if the count and
 * the insert cannot interleave, which is the SQL side's problem and not this
 * module's: `enforce_rate_limit` serialises a caller's decisions on a
 * transaction-scoped advisory lock (contract 145, risk-register `DATA-007`).
 * Before that, concurrent requests could each observe a count below `max` and
 * all proceed.
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
