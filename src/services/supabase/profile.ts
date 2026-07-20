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

/**
 * Create the signed-in user's profile row. Called immediately after sign-up,
 * once a session exists, so RLS ("own profile") admits the insert. The
 * display_name length is also enforced by a DB check (1–40 chars).
 */
export async function createMyProfile(userId: string, displayName: string): Promise<Profile> {
  const trimmed = displayName.trim()
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, display_name: trimmed })
    .select('id, display_name')
    .single()
  if (error) throw error
  return { id: data.id, displayName: data.display_name }
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
