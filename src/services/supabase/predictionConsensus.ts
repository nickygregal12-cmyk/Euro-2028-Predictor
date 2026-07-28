import { supabase } from './client'
import {
  mapPredictionConsensus,
  type PredictionConsensus,
} from './predictionConsensusModel'

export async function fetchPredictionConsensus(
  tournamentId: string,
): Promise<PredictionConsensus> {
  const { data, error } = await supabase.rpc('get_prediction_consensus', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapPredictionConsensus(data)
}
