// Contract 183 / `MIG-UI-18` query wrapper. The server owns the total order,
// the window, the caller's own position and WHO MAY READ IT AT ALL:
// `get_season_leaderboard_neighbourhood` refuses a caller holding no entry in
// the season, in contract 95's order, so a non-entrant and a nonexistent season
// are not distinguishable by error code.
//
// This module never selects entries, profiles or standings directly, and must
// not grow a fallback that does — a browser-assembled neighbourhood would be a
// second ranking authority free to disagree with the paged leaderboard.

import { reportReadFailure } from '../observability/readFailure'
import { db } from './client'
import {
  mapSeasonLeaderboardNeighbourhood,
  type SeasonLeaderboardNeighbourhood,
} from './seasonLeaderboardNeighbourhoodModel'

export type {
  SeasonLeaderboardNeighbourhood,
  SeasonNeighbourRow,
  SeasonNeighbourhoodYou,
} from './seasonLeaderboardNeighbourhoodModel'

export type SeasonNeighbourhoodOptions = {
  /**
   * How many entrants either side. The server clamps this to 1..10 and returns
   * the value it actually applied, so a caller asking for more is corrected
   * rather than refused — see the migration's own note that a caller asking for
   * 500 neighbours is asking for the leaderboard, and that read already exists.
   */
  window?: number
}

/** Fetch the symmetric window of entrants around the caller's own position. */
export async function fetchSeasonLeaderboardNeighbourhood(
  tournamentId: string,
  options: SeasonNeighbourhoodOptions = {},
): Promise<SeasonLeaderboardNeighbourhood> {
  const { data, error } = await db.rpc('get_season_leaderboard_neighbourhood', {
    p_tournament_id: tournamentId,
    ...(options.window == null ? {} : { p_window: options.window }),
  })
  if (error) {
    reportReadFailure('season-leaderboard.neighbourhood', error)
    throw error
  }
  return mapSeasonLeaderboardNeighbourhood(data)
}
