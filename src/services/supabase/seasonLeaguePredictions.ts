import { createConcurrencyGate } from '../concurrency/boundedGate'
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

/**
 * One deliberate browser-side ceiling for this comparatively expensive read.
 *
 * Match Centre asks for one panel per private league and deliberately preserves
 * them all. The previous `Promise.all(leagues.map(...))` made the current league
 * cap an accidental transport bound; raising that cap later could turn one page
 * into tens or hundreds of simultaneous RPCs. The service boundary is the right
 * place to cap the ACTUAL calls: every caller keeps all requested results and
 * its own ordering/failure semantics, while at most four RPCs enter at once.
 */
export const SEASON_LEAGUE_PREDICTION_READ_CONCURRENCY = 4
const runSeasonLeaguePredictionRead = createConcurrencyGate(
  SEASON_LEAGUE_PREDICTION_READ_CONCURRENCY,
)

export async function fetchSeasonLeagueMatchweekPredictions(
  leagueId: string,
  competitionRoundId: string,
): Promise<SeasonLeagueMatchweekPredictions> {
  return runSeasonLeaguePredictionRead(async () => {
    const { data, error } = await db.rpc('get_season_league_matchweek_predictions', {
      p_league_id: leagueId,
      p_competition_round_id: competitionRoundId,
    })
    if (error) throw error
    return mapSeasonLeagueMatchweekPredictions(data)
  })
}
