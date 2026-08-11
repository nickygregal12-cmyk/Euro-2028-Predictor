import { db } from './client'
import {
  mapSeasonLeagueMatchweekPredictions,
  type SeasonLeagueMatchweekPredictions,
} from './seasonLeaguePredictionsModel'

/**
 * Query wrapper for contract 149's `get_season_league_matchweek_predictions`.
 *
 * The reveal boundary, the membership check and the hidden-rather-than-refused
 * behaviour are all the RPC's; the decoder in
 * `seasonLeaguePredictionsModel.ts` restates them so they can be tested without
 * a client, and this file is only the call.
 */
export type {
  SeasonLeagueMatchweekPredictions,
  SeasonLeaguePrediction,
  SeasonLeaguePredictionFixture,
  SeasonLeaguePredictionMember,
} from './seasonLeaguePredictionsModel'

export async function fetchSeasonLeagueMatchweekPredictions(
  leagueId: string,
  competitionRoundId: string,
): Promise<SeasonLeagueMatchweekPredictions> {
  const { data, error } = await db.rpc('get_season_league_matchweek_predictions', {
    p_league_id: leagueId,
    p_competition_round_id: competitionRoundId,
  })
  if (error) throw error
  return mapSeasonLeagueMatchweekPredictions(data)
}
