import { supabase } from './client'
import { mapCupResponse, type CupRead } from './cupModel'

/** Bounded Predictor Cup read: draw state, my group and my head-to-head ties. */
export async function fetchMyCup(tournamentId: string): Promise<CupRead> {
  const { data, error } = await supabase.rpc('get_my_cup', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapCupResponse(data)
}
