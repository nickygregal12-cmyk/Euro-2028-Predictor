import { db } from './client'
import {
  mapKoStandingsResponse,
  type KoStandingsRead,
} from './koPredictorStandingsModel'

/**
 * Bounded, server-ranked global KO Predictor standings (contract 52). Pass
 * the previous page's cursor to continue; the server owns rank and order.
 */
export async function fetchKoPredictorStandings(
  tournamentId: string,
  after: string | null = null,
): Promise<KoStandingsRead> {
  const { data, error } = await db.rpc('get_ko_predictor_standings', {
    p_tournament_id: tournamentId,
    p_limit: 50,
    ...(after == null ? {} : { p_after: after }),
  })
  if (error) throw error
  return mapKoStandingsResponse(data)
}
