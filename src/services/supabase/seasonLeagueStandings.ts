// Season private-league standings query wrapper (contract 128's
// `get_season_league_standings`).
//
// WHY NOT `get_league_members`. That read derives every metric from
// `predictor_internal.standing_metrics`, `score_events`, `matches` and
// `match_predictions` — tournament scoring tables a competition season writes
// none of — so a league on a season came back with every member on zero in
// alphabetical order and no error at all. Contract 128 added this read and made
// the tournament one REFUSE a season league by naming the function that
// answers, so the two can never be silently swapped again.
//
// THE PAGE IS THE SERVER'S. Ranking, ordering, page bounds, the cursor and the
// caller's own row all come from the RPC. This module must never grow a
// fallback that selects `league_members`, `profiles` or `season_standings`
// directly: a browser-side league table would be a second ranking authority,
// and the first thing it would do is disagree with the season's.

import { supabase } from './client'
import {
  mapSeasonLeagueStandingsPage,
  type SeasonLeagueStandingsPage,
} from './seasonLeagueStandingsModel'

export type {
  SeasonLeagueStandingsPage,
  SeasonLeagueStandingsRow,
  SeasonLeagueStandingsYou,
} from './seasonLeagueStandingsModel'

export type SeasonLeagueStandingsPageOptions = {
  limit?: number
  after?: string | null
}

/**
 * Fetch one server-ranked page of a season private league's table.
 *
 * Page size is clamped by Postgres, so a caller asking for more than the
 * server's maximum gets the maximum rather than an error.
 */
export async function fetchSeasonLeagueStandingsPage(
  leagueId: string,
  options: SeasonLeagueStandingsPageOptions = {},
): Promise<SeasonLeagueStandingsPage> {
  const { data, error } = await supabase.rpc('get_season_league_standings', {
    p_league_id: leagueId,
    p_limit: options.limit ?? 50,
    p_after: options.after ?? null,
  })
  if (error) throw error
  return mapSeasonLeagueStandingsPage(data)
}
