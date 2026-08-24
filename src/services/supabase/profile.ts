// Profile query wrappers.

import { db } from './client'
import { recordProductEvent } from '../analytics/productEvents'

export type Profile = {
  id: string
  displayName: string
}

/** The signed-in user's profile row, or null if it hasn't been created yet. */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id: data.id, displayName: data.display_name }
}

// (Profile creation on sign-up now happens server-side via the
// on_auth_user_created trigger — see 20260720190000_profile_on_signup.sql. The
// former client-side createMyProfile was removed: it depended on a live session
// and broke under email confirmation, the 2026-07-20 incident.)

/**
 * The user's /welcome seen-timestamp. Best-effort: the column is a follow-up
 * migration (20260720160000_add_profile_welcomed_at.sql). If it isn't applied
 * yet (or the read fails), we return a NON-null sentinel so the gate treats the
 * user as already welcomed — a missing column must never trap anyone on a
 * welcome screen. Real reads return the actual value (null = show it).
 */
export type MyAccount = { displayName: string; reminderEmails: boolean }

/** The private Account read: own display name and preferences. */
export async function fetchMyAccount(userId: string): Promise<MyAccount | null> {
  const { data, error } = await db
    .from('profiles')
    .select('display_name, reminder_emails')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { displayName: data.display_name, reminderEmails: data.reminder_emails }
}

/** Rename the own profile; the server moderation trigger is the gate. */
export async function updateMyDisplayName(
  userId: string,
  displayName: string,
): Promise<void> {
  const { error } = await db
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
  if (error) throw error
}

/** The deadline-reminder opt-out (design-system §Account — default on). */
export async function updateReminderEmails(
  userId: string,
  reminderEmails: boolean,
): Promise<void> {
  const { error } = await db
    .from('profiles')
    .update({ reminder_emails: reminderEmails })
    .eq('id', userId)
  if (error) throw error
  // Which way it was turned is the whole signal; who turned it is not recorded.
  recordProductEvent('reminders_changed', { enabled: reminderEmails })
}

export async function fetchWelcomedAt(userId: string): Promise<{ welcomedAt: string | null }> {
  try {
    const { data, error } = await db
      .from('profiles')
      .select('welcomed_at')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return { welcomedAt: PRE_MIGRATION_SENTINEL }
    return { welcomedAt: (data as { welcomed_at: string | null }).welcomed_at ?? null }
  } catch {
    return { welcomedAt: PRE_MIGRATION_SENTINEL }
  }
}

// A non-null value so a pre-migration read reads as "already welcomed".
const PRE_MIGRATION_SENTINEL = '1970-01-01T00:00:00.000Z'

/**
 * Stamp `welcomed_at = now()` the first time the user sees /welcome (own-profile
 * RLS). The `is null` guard keeps the FIRST-seen time and makes re-calls no-ops.
 * Best-effort — the gate flips to "seen" optimistically in memory regardless, so
 * a failed write just means the screen may reappear next session, never a block.
 */
export async function markWelcomedNow(userId: string): Promise<void> {
  try {
    await db
      .from('profiles')
      .update({ welcomed_at: new Date().toISOString() })
      .eq('id', userId)
      .is('welcomed_at', null)
  } catch {
    // ignore — see the doc comment; the in-memory flag already advanced
  }
}

export type LastSeen = { lastSeenAt: string | null; lastSeenPoints: number | null }

export type LastSeenRead =
  | { available: true; value: LastSeen }
  | { available: false; value: null }

/**
 * Availability-preserving last-seen read for screens that must distinguish a
 * missing snapshot from an unavailable remote source.
 */
export async function fetchLastSeenRead(userId: string): Promise<LastSeenRead> {
  try {
    const { data, error } = await db
      .from('profiles')
      .select('last_seen_at, last_seen_points')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return { available: false, value: null }
    return {
      available: true,
      value: {
        lastSeenAt: (data as { last_seen_at: string | null }).last_seen_at ?? null,
        lastSeenPoints: (data as { last_seen_points: number | null }).last_seen_points ?? null,
      },
    }
  } catch {
    return { available: false, value: null }
  }
}

/**
 * Snapshot "seen now, at this total" (own-profile RLS). Best-effort — a missing
 * column just means the catch-up line never fires; never blocks Home from loading.
 */
export async function updateLastSeen(userId: string, points: number): Promise<void> {
  try {
    await db
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString(), last_seen_points: points })
      .eq('id', userId)
  } catch {
    // ignore — the snapshot is a nicety, not load-bearing
  }
}
