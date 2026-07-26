import { supabase } from './client'

export async function hasTournamentAdminAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_tournament_admin')
  return !error && data === true
}
