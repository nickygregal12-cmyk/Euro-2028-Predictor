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
