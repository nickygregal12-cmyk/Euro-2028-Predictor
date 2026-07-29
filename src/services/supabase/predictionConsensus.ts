import { supabase } from './client'
import {
  mapPredictionConsensus,
  type PredictionConsensus,
} from './predictionConsensusModel'

export type ConsensusPlayer = {
  id: string
  name: string
  teamId: string | null
}

export async function fetchPredictionConsensus(
  tournamentId: string,
): Promise<PredictionConsensus> {
  const { data, error } = await supabase.rpc('get_prediction_consensus', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapPredictionConsensus(data)
}

export async function fetchConsensusPlayers(playerIds: string[]): Promise<ConsensusPlayer[]> {
  const ids = [...new Set(playerIds)].filter(Boolean)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('players')
    .select('id, name, team_id')
    .in('id', ids)
  if (error) throw error

  return (data ?? []).map((player) => ({
    id: player.id,
    name: player.name,
    teamId: player.team_id,
  }))
}
