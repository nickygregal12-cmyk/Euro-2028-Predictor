import { db } from './client'
import {
  mapPredictionConsensusResponse,
  type PredictionConsensusResponse,
} from './predictionConsensusResponse'

export type ConsensusPlayer = {
  id: string
  name: string
  teamId: string | null
}

export async function fetchPredictionConsensus(
  tournamentId: string,
): Promise<PredictionConsensusResponse> {
  const { data, error } = await db.rpc('get_prediction_consensus', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapPredictionConsensusResponse(data)
}

export async function fetchConsensusPlayers(playerIds: string[]): Promise<ConsensusPlayer[]> {
  const ids = [...new Set(playerIds)].filter(Boolean)
  if (ids.length === 0) return []

  const { data, error } = await db
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
