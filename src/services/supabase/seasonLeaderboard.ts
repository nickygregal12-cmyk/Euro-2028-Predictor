// Season leaderboard query wrapper. The server owns ranking, ordering, page
// bounds, the caller's own row and — unlike the tournament leaderboard — WHO
// MAY READ IT AT ALL: `get_season_leaderboard` refuses a caller holding no
// entry in the season, because seasons run side by side and their members are
// not co-members. This module never selects entries, profiles or matchweek
// scores directly, and must not grow a fallback that does.

import { reportReadFailure } from '../observability/readFailure'
import { db } from './client'
import {
  mapSeasonLeaderboardPage,
  type SeasonLeaderboardPage,
} from './seasonLeaderboardModel'

export type {
  SeasonLeaderboardPage,
  SeasonLeaderboardRow,
  SeasonLeaderboardYou,
  SeasonPlayerReach,
} from './seasonLeaderboardModel'

export type SeasonLeaderboardPageOptions = {
  limit?: number
  after?: string | null
}

/** Fetch one server-ranked season leaderboard page. Page size is clamped by Postgres. */
export async function fetchSeasonLeaderboardPage(
  tournamentId: string,
  options: SeasonLeaderboardPageOptions = {},
): Promise<SeasonLeaderboardPage> {
  const { data, error } = await db.rpc('get_season_leaderboard', {
    p_tournament_id: tournamentId,
    p_limit: options.limit ?? 50,
    ...(options.after == null ? {} : { p_after: options.after }),
  })
  if (error) {
    reportReadFailure('season-leaderboard.page', error)
    throw error
  }
  return mapSeasonLeaderboardPage(data)
}
