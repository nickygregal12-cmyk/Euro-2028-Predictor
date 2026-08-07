// Season period-standings query wrapper (contract 122). The server owns both
// retention views ADR 0012 names — the monthly table and rolling form — and
// owns who may read them: `get_season_period_standings` refuses a caller
// holding no entry in the season, exactly as the cumulative read does. This
// module never selects matchweek scores, rounds or entries directly, and must
// not grow a fallback that does.
//
// THE ONE THING IT DOES READ DIRECTLY is the caller's own `entries` row, and
// only its id. The period read returns `entry_id` with no name, deliberately,
// so the surface cannot tell which row is the caller's without knowing their
// own entry. RLS on `entries` is `user_id = auth.uid()` for select, so this
// discloses nothing that is not already the caller's own — and it is the same
// bootstrap `entrySubmissionStatus.ts` already performs.

import { supabase } from './client'
import {
  mapSeasonPeriodStandings,
  type SeasonPeriodStandings,
} from './seasonPeriodStandingsModel'

export type {
  SeasonMonthTable,
  SeasonPeriodRow,
  SeasonPeriodStandings,
} from './seasonPeriodStandingsModel'

export type SeasonPeriod = 'month' | 'form'

/** Fetch one of the two derived season tables. Neither decides the season. */
export async function fetchSeasonPeriodStandings(
  tournamentId: string,
  period: SeasonPeriod,
  window?: number,
  /**
   * Contract 131. Off by default, which is contract 122's decision preserved:
   * a surface that already holds the names does not ask for them again. Ask
   * when there is no leaderboard beside the table, because `entry_id` is not a
   * person and every row would otherwise render as "Entrant".
   */
  includeNames = false,
): Promise<SeasonPeriodStandings> {
  const { data, error } = await supabase.rpc('get_season_period_standings', {
    p_tournament_id: tournamentId,
    p_period: period,
    p_window: window ?? 5,
    p_include_names: includeNames,
  })
  if (error) throw error
  return mapSeasonPeriodStandings(data)
}

/**
 * The caller's own entry in a season, or null when they hold none.
 *
 * Null is ordinary rather than an error: a competition member who has not
 * joined the Match Predictor has no entry, and the period read would refuse
 * them anyway. The caller decides what to say about it.
 */
export async function fetchMyEntryId(
  userId: string,
  tournamentId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('id')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .maybeSingle()

  if (error) throw error
  return data ? (data.id as string) : null
}
