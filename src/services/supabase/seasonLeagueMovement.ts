import { db } from './client'
import {
  mapSeasonLeagueMovement,
  type SeasonLeagueMovement,
} from './seasonLeagueMovementModel'

/**
 * Query wrapper for contract 150's `get_season_league_rank_movement`.
 *
 * The settled gate, the ordinal ordering and the derivation from banked
 * matchweek scores are all the RPC's. The decoder in
 * `seasonLeagueMovementModel.ts` is pure so the settled gate is testable
 * without a client.
 */
export type {
  SeasonLeagueMovement,
  SeasonLeagueMovementRow,
} from './seasonLeagueMovementModel'

/**
 * Movement over one matchweek, or over the most recent settled one when no
 * matchweek is named — which is the question every calling surface is really
 * asking.
 */
export async function fetchSeasonLeagueMovement(
  leagueId: string,
  competitionRoundId?: string | null,
): Promise<SeasonLeagueMovement> {
  const { data, error } = await db.rpc('get_season_league_rank_movement', {
    p_league_id: leagueId,
    p_competition_round_id: competitionRoundId ?? undefined,
  })
  if (error) throw error
  return mapSeasonLeagueMovement(data)
}
