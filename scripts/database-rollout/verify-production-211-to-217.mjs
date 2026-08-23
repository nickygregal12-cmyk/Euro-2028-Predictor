#!/usr/bin/env node
// Contract 211 to 217: the one verifier the rehearsal and the rollout both run.
//
// It is a FILE rather than a heredoc in each workflow because the rehearsal only
// means something if it asks the same question the rollout will. Two copies of a
// verification drift, and the copy that drifts is the one nobody reads.
//
// Reads three JSON documents produced by the two SQL files beside it:
//   BEFORE_FILE   preserved state at contract 211
//   AFTER_FILE    preserved state at contract 217
//   BOUNDARY_FILE what contracts 212 to 217 must have done, at 217
//
// Exits non-zero naming every problem it found, rather than the first.
import fs from 'node:fs'

const load = (variable) => {
  const path = process.env[variable]
  if (!path) throw new Error(`${variable} is not set`)
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

const before = load('BEFORE_FILE')
const after = load('AFTER_FILE')
const boundary = load('BOUNDARY_FILE')

const problems = []
const eq = (label, actual, expected) => {
  if (String(actual) !== String(expected)) problems.push(`${label} = ${actual}, expected ${expected}`)
}
const same = (label, actual, expected) => {
  if (JSON.stringify(actual ?? null) !== JSON.stringify(expected ?? null)) {
    problems.push(`${label} moved: ${JSON.stringify(before[label] ?? null)} -> ${JSON.stringify(after[label] ?? null)}`)
  }
}

// ---------------------------------------------------------------------------
// The ledger arrived where it was sent.
// ---------------------------------------------------------------------------
eq('migration_count', after.migration_count, 217)
eq('latest_version', after.latest_version, '20260824090000')
eq('latest_name', after.latest_name, 'web_push_channel')

// ---------------------------------------------------------------------------
// NOT ONE PLAYER-OWNED ROW MOVED, and nothing outside the boundary did either.
// ---------------------------------------------------------------------------
for (const key of [
  'auth_users', 'profiles', 'entries', 'season_predictions', 'match_predictions',
  'league_members', 'season_fixtures', 'reminder_deliveries', 'ai_bets',
  'public_enabled', 'betting_public_enabled',
  'lifecycle_transition_count', 'provider_status_observation_count',
  'protected_function_fingerprint',
]) eq(key, after[key], before[key])

// Compared whole, because a total cannot see a fixture move between statuses.
same('fixture_status_histogram', after.fixture_status_histogram, before.fixture_status_histogram)
// Contract 211 settled these five tiers. Nothing in 212 to 217 may touch them.
same('poll_dials', after.poll_dials, before.poll_dials)

// Contract 216 schedules exactly one new job, `player-reminder-dispatch`.
// Exactly one: a second is as wrong as none.
eq('cron_jobs', after.cron_jobs, Number(before.cron_jobs) + 1)

// ---------------------------------------------------------------------------
// Contract 212 — the card publishes the lock it is enforced against.
// ---------------------------------------------------------------------------
eq('card_calls_lock_authority', boundary.card_calls_lock_authority, true)
eq('card_publishes_lock_fields', boundary.card_publishes_lock_fields, true)
eq('buffer_authority_present', boundary.buffer_authority_present, 1)

// ---------------------------------------------------------------------------
// Contract 213 — the unmeasured tokens fail closed, the measured one survives.
// ---------------------------------------------------------------------------
eq('dropped_tokens_remaining', boundary.dropped_tokens_remaining, 0)
eq('dropped_tokens_not_unknown', boundary.dropped_tokens_not_unknown, 0)
eq('measured_postponed_kind', boundary.measured_postponed_kind, 'postponed')
eq('cancelled_or_abandoned_mappings', boundary.cancelled_or_abandoned_mappings, 0)

// ---------------------------------------------------------------------------
// Contract 214 — confirmation tracks the current card.
// ---------------------------------------------------------------------------
eq('confirmation_reference_present', boundary.confirmation_reference_present, 1)
eq('confirm_calls_confirmation_reference', boundary.confirm_calls_confirmation_reference, true)

// ---------------------------------------------------------------------------
// Contract 215 — a current value follows the canonical forecast.
// ---------------------------------------------------------------------------
eq('canonical_view_uses_canonical', boundary.canonical_view_uses_canonical, true)

// ---------------------------------------------------------------------------
// Contract 216 — the sender has a caller, and the gate is SHUT on arrival.
// ---------------------------------------------------------------------------
eq('dispatch_runs_rls', boundary.dispatch_runs_rls, true)
eq('dispatch_job_schedule', boundary.dispatch_job_schedule, '*/5 * * * *')
eq('dispatch_job_active', boundary.dispatch_job_active, true)
// Applying this boundary must not send, or pay for, anything. The vault holds no
// dispatch URL and no caller key, so every firing records a refusal and posts
// nothing. `secrets_present` false is the whole reason this promotion is safe to
// run before a sender is configured.
eq('sender_secrets_present', boundary.sender_configuration?.secrets_present, false)
eq('sender_configured', boundary.sender_configuration?.configured, false)
eq('sender_error', boundary.sender_configuration?.error, null)

// ---------------------------------------------------------------------------
// Contract 217 — push as a second channel, arriving with nobody subscribed.
// ---------------------------------------------------------------------------
eq('push_subscriptions_rls', boundary.push_subscriptions_rls, true)
eq('push_subscriptions_rows', boundary.push_subscriptions_rows, 0)
eq('push_subscriptions_policies', boundary.push_subscriptions_policies, 2)
eq('push_subscriptions_anon_grants', boundary.push_subscriptions_anon_grants, 0)
// Read and revoke, never write: the endpoint is unique across the platform, so a
// player revoking one they do not own is the case an own-row policy cannot state
// and a definer save has to.
eq('push_subscriptions_authenticated_grants', boundary.push_subscriptions_authenticated_grants, 'delete,select')
eq('reminder_deliveries_channel_default', boundary.reminder_deliveries_channel_default, "'email'::text")
eq('reminder_deliveries_non_email', boundary.reminder_deliveries_non_email, 0)
eq('claim_returns_channel', boundary.claim_returns_channel, true)

// THE GRANTS ON THE DROPPED AND RECREATED FUNCTION. This is the specific risk
// contract 217's `drop function` introduces — a dropped function takes its
// grants with it — and the ledger cannot answer it.
eq('claim_service_role_execute', boundary.claim_service_role_execute, true)
eq('claim_authenticated_execute', boundary.claim_authenticated_execute, false)
eq('claim_anon_execute', boundary.claim_anon_execute, false)
eq('save_push_authenticated_execute', boundary.save_push_authenticated_execute, true)
eq('save_push_anon_execute', boundary.save_push_anon_execute, false)

// A player with both channels available is still told once.
if (!/user_id/.test(boundary.once_per_action_key ?? '') ||
    !/action_key/.test(boundary.once_per_action_key ?? '') ||
    !/reminder_kind/.test(boundary.once_per_action_key ?? '')) {
  problems.push(`once_per_action_key = ${boundary.once_per_action_key}, expected UNIQUE (user_id, action_key, reminder_kind)`)
}

if (problems.length) {
  throw new Error(`CONTRACT 211 TO 217 VERIFICATION FAILED:\n - ${problems.join('\n - ')}`)
}
console.log('Contract 211 to 217 verification passed: ledger at 217, boundary driven, protected state unmoved.')
