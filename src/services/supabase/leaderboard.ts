// Overall leaderboard query wrapper. The server owns ordering, ranks, page
// bounds and current-user context through the paginated `get_leaderboard` RPC.
// This module never selects profiles, entries or score events directly.

import { reportReadFailure } from '../observability/readFailure'
import { db } from './client'
import {
  mapLeaderboardPage,
  type LeaderboardPage,
} from './leaderboardModel'

export type { LeaderboardPage, LeaderboardRow, LeaderboardYou } from './leaderboardModel'

export type LeaderboardPageOptions = {
  limit?: number
  after?: string | null
}

/** Fetch one server-ranked leaderboard page. Page sizes are clamped by Postgres. */
export async function fetchLeaderboardPage(
  tournamentId: string,
  options: LeaderboardPageOptions = {},
): Promise<LeaderboardPage> {
  const { data, error } = await db.rpc('get_leaderboard', {
    p_tournament_id: tournamentId,
    p_limit: options.limit ?? 50,
    ...(options.after == null ? {} : { p_after: options.after }),
  })
  if (error) {
    reportReadFailure('leaderboard.page', error)
    throw error
  }
  return mapLeaderboardPage(data)
}
