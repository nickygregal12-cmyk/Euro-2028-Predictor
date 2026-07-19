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
