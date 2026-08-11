import { db } from './client'
import { rpcArgs } from './rpcArguments'
import {
  mapKnockoutStoreResponse,
  type KnockoutStoreRead,
} from './knockoutPredictionsModel'

/** Bounded read of the caller's own shared knockout predictions. */
export async function fetchMyKnockoutPredictions(
  tournamentId: string,
): Promise<KnockoutStoreRead> {
  const { data, error } = await db.rpc('get_my_knockout_predictions', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapKnockoutStoreResponse(data)
}

export type SaveKnockoutPredictionInput = {
  matchId: string
  homeScore: number
  awayScore: number
  /** Required exactly when the scoreline is a draw; must be null otherwise. */
  advancingTeamId: string | null
  /** The version last read for this match; null when no row was read. */
  expectedVersion: number | null
}

/**
 * Version-guarded save. The database owns the per-kickoff lock, the entrant
 * gate and the draw/through shape; returns the stored version to echo next.
 */
export async function saveKnockoutPrediction(
  input: SaveKnockoutPredictionInput,
): Promise<number> {
  const { data, error } = await db.rpc(
    'save_knockout_prediction',
    rpcArgs(
      'save_knockout_prediction',
      ['p_advancing_team_id', 'p_expected_version'],
      {
        p_match_id: input.matchId,
        p_home: input.homeScore,
        p_away: input.awayScore,
        p_advancing_team_id: input.advancingTeamId,
        p_expected_version: input.expectedVersion,
      },
    ),
  )
  if (error) throw error

  const version = (data as Record<string, unknown> | null)?.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new Error('Knockout prediction save returned an invalid version.')
  }
  return version
}

/** Version-guarded clear; idempotent when the prediction is already absent. */
export async function deleteKnockoutPrediction(
  matchId: string,
  expectedVersion: number | null,
): Promise<void> {
  const { error } = await db.rpc(
    'delete_knockout_prediction',
    rpcArgs('delete_knockout_prediction', ['p_expected_version'], {
      p_match_id: matchId,
      p_expected_version: expectedVersion,
    }),
  )
  if (error) throw error
}
