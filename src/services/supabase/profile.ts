// Profile query wrappers.

import { supabase } from './client'

export type Profile = {
  id: string
  displayName: string
}

/** The signed-in user's profile row, or null if it hasn't been created yet. */
export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
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
export async function fetchWelcomedAt(userId: string): Promise<{ welcomedAt: string | null }> {
  try {
    const { data, error } = await supabase
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
    await supabase
      .from('profiles')
      .update({ welcomed_at: new Date().toISOString() })
      .eq('id', userId)
      .is('welcomed_at', null)
  } catch {
    // ignore — see the doc comment; the in-memory flag already advanced
  }
}

export type LastSeen = { lastSeenAt: string | null; lastSeenPoints: number | null }

/**
 * The user's last-seen snapshot (for Home's catch-up line). Best-effort: the
 * columns are a follow-up migration (20260720150000_add_last_seen.sql), so a DB
 * without it just reads as "no snapshot" (catch-up stays hidden) rather than
 * erroring — the same fail-soft pattern as tournaments.lock_at.
 */
export async function fetchLastSeen(userId: string): Promise<LastSeen> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('last_seen_at, last_seen_points')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return { lastSeenAt: null, lastSeenPoints: null }
    return {
      lastSeenAt: (data as { last_seen_at: string | null }).last_seen_at ?? null,
      lastSeenPoints: (data as { last_seen_points: number | null }).last_seen_points ?? null,
    }
  } catch {
    return { lastSeenAt: null, lastSeenPoints: null }
  }
}

/**
 * Snapshot "seen now, at this total" (own-profile RLS). Best-effort — a missing
 * column just means the catch-up line never fires; never blocks Home from loading.
 */
export async function updateLastSeen(userId: string, points: number): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString(), last_seen_points: points })
      .eq('id', userId)
  } catch {
    // ignore — the snapshot is a nicety, not load-bearing
  }
}
