import { supabase } from './client'
import {
  mapH2HRankHistory,
  type H2HRankHistory,
  type RankHistoryPoint,
} from './h2hRankHistoryModel'

export type { H2HRankHistory, RankHistoryPoint }

export async function fetchH2HRankHistory(
  rivalId: string,
  tournamentId: string,
): Promise<H2HRankHistory> {
  const { data, error } = await supabase.rpc('get_h2h_rank_history', {
    p_rival_id: rivalId,
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapH2HRankHistory(data)
}
