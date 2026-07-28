import { supabase } from './client'
import { mapPlayerProfile, type PlayerProfileRead } from './playerProfileModel'

export type { PlayerProfileDetail, PlayerProfileRead } from './playerProfileModel'

export async function fetchPlayerProfile(
  playerId: string,
  tournamentId: string,
): Promise<PlayerProfileRead> {
  const { data, error } = await supabase.rpc('get_player_profile', {
    p_player_id: playerId,
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapPlayerProfile(data)
}
