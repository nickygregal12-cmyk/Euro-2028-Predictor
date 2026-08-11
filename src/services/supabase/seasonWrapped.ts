import { db } from './client'
import { mapSeasonWrapped, type SeasonWrapped } from './seasonWrappedModel'

/**
 * Query wrapper for contract 156's `get_season_wrapped`.
 *
 * ONE SEASON, THE CALLER'S OWN. There is no parameter for whose Wrapped to
 * read: the function resolves the caller from `auth.uid()`, so a Wrapped is
 * unshareable by construction and no disclosure decision is being taken here.
 *
 * A SEASON THAT HAS NOT FINISHED RETURNS `{ finalised: false }` and this
 * wrapper passes that through untouched. Callers render it as "not yet",
 * never as a season of zeros.
 */

export type {
  SeasonWrapped,
  SeasonWrappedAccuracy,
  SeasonWrappedBestMatchweek,
  SeasonWrappedTotals,
} from './seasonWrappedModel'
export { correctOutcomeRate, exactScoreRate } from './seasonWrappedModel'

export async function fetchSeasonWrapped(tournamentId: string): Promise<SeasonWrapped> {
  const { data, error } = await db.rpc('get_season_wrapped', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapSeasonWrapped(data)
}
