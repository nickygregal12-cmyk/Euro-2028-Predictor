import { db } from './client'
import {
  mapSeasonPlayerProfile,
  type SeasonPlayerProfile,
} from './seasonPlayerProfileModel'

/**
 * Query wrapper for contract 151's `get_season_player_profile`.
 *
 * The co-membership disclosure boundary, the per-matchweek reveal and the
 * settled-only accuracy counts are all the RPC's; this file only calls it. The
 * decoder in `seasonPlayerProfileModel.ts` is pure so the entered and
 * not-entered answers are testable without a client.
 */
export type {
  SeasonPlayerProfile,
  SeasonProfileAccuracy,
  SeasonProfileJokers,
  SeasonProfileMatchweek,
  SeasonProfilePlayer,
  SeasonProfileSeason,
} from './seasonPlayerProfileModel'

export async function fetchSeasonPlayerProfile(
  tournamentId: string,
  playerId: string,
): Promise<SeasonPlayerProfile> {
  const { data, error } = await db.rpc('get_season_player_profile', {
    p_tournament_id: tournamentId,
    p_player_id: playerId,
  })
  if (error) throw error
  return mapSeasonPlayerProfile(data)
}
