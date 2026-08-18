// Season rank-history query wrapper (contract 192). The server owns the
// standing, the field it is out of, the ordering and — through contract 191's
// `reach` — WHO MAY READ IT: `get_season_rank_history` refuses a caller holding
// no entry in the season, and refuses again where reach is `none`.
//
// ITS BOUNDARY IS WIDER THAN THE PROFILE'S, DELIBERATELY. Contract 151 needs a
// shared private league; this needs only `compare`, because a matchweek, a
// total and a position are what the season leaderboard already shows every
// entrant, and no prediction appears in the payload. A caller may therefore be
// able to plot a player they cannot open a profile for.
//
// IT IS ADDRESSED BY THE ENTRY REFERENCE, not the account id — contract 191's
// season-scoped `playerRef`. Omitting it asks about the caller, which is the
// common case and saves a surface looking up its own address to ask about
// itself.
//
// This module never selects entries, standings or matchweek scores directly,
// and must not grow a fallback that does.

import { db } from './client'
import {
  OpponentNotEnteredError,
  RankHistoryNotPermittedError,
  mapSeasonRankHistory,
  type SeasonRankHistory,
} from './seasonRankHistoryModel'

export {
  OpponentNotEnteredError,
  RankHistoryNotPermittedError,
} from './seasonRankHistoryModel'
export type {
  SeasonRankHistory,
  SeasonRankHistoryPoint,
  SeasonRankHistoryReach,
} from './seasonRankHistoryModel'

function codeOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : ''
}

/**
 * Fetch one player's position over a season.
 *
 * IT REFUSES IN TWO WAYS AND THEY MEAN DIFFERENT THINGS: 42501 is contract
 * 191's `none`, or a caller holding no entry — about PERMISSION; no_data_found
 * is a player who holds no entry in this season — about THEM. A surface that
 * reported the second as the first would accuse the reader of lacking a
 * permission that was never the problem.
 *
 * @param playerRef contract 191's season-scoped entry reference. Omit — or pass
 * `null` — for the caller's own history.
 */
export async function fetchSeasonRankHistory(
  tournamentId: string,
  playerRef: string | null = null,
): Promise<SeasonRankHistory> {
  const { data, error } = await db.rpc('get_season_rank_history', {
    p_tournament_id: tournamentId,
    ...(playerRef === null ? {} : { p_player_ref: playerRef }),
  })

  if (error) {
    const code = codeOf(error)
    if (code === '42501' || code === 'insufficient_privilege') {
      throw new RankHistoryNotPermittedError()
    }
    if (code === 'no_data_found' || code === '02000') {
      throw new OpponentNotEnteredError()
    }
    throw error
  }

  return mapSeasonRankHistory(data)
}
