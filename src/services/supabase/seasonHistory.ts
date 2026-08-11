import { db } from './client'
import { mapSeasonHistoryPage, type SeasonHistoryPage } from './seasonHistoryModel'

/**
 * Query wrapper for contract 161's `get_my_season_history`.
 *
 * IT CLOSES `MIG-UI-17`. The Profile's season history could previously only ask
 * about seasons the published catalogue still carried, so a season archived and
 * unpublished was invisible to a player who had played it. This is keyed on
 * PARTICIPATION, so it is not.
 *
 * IT TAKES NO PLAYER ARGUMENT AND SO IS NOT A DIRECTORY.
 */

export type {
  SeasonHistoryEntry,
  SeasonHistoryFinal,
  SeasonHistoryGame,
  SeasonHistoryPage,
} from './seasonHistoryModel'

export async function fetchMySeasonHistory(
  limit?: number,
  offset?: number,
): Promise<SeasonHistoryPage> {
  const { data, error } = await db.rpc('get_my_season_history', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return mapSeasonHistoryPage(data)
}
