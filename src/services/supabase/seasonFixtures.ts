// Season fixture query wrapper for the competition Matches surface.
//
// IT READS THE CARD RPC AND KEEPS ONLY THE FOOTBALL. `get_season_matchweek_card`
// is the one browser read that returns a season's fixtures with their kickoffs,
// status and results, and — this is the part that makes a competition surface
// possible at all — `predictor_internal.season_card_context` TOLERATES A CALLER
// WITH NO ENTRY, returning `card_status: 'no_submission'` rather than refusing.
// So a player following a competition can browse its fixtures without having
// joined the Main Predictor, which is exactly what §7.3 asks of Matches: it is
// a competition section, not a game section.
//
// This module never selects `season_fixtures`, `competition_rounds` or `teams`
// directly — all three are revoked from every browser role — and must not grow
// a fallback that tries.

import { supabase } from './client'
import {
  mapSeasonMatchweekFixtures,
  type SeasonMatchweekFixtures,
} from './seasonFixturesModel'

export type {
  SeasonFixture,
  SeasonFixtureStatus,
  SeasonMatchweekFixtures,
} from './seasonFixturesModel'

/** One matchweek's fixtures, with results where the server has them. */
export async function fetchSeasonMatchweekFixtures(
  tournamentId: string,
  matchweek: number,
): Promise<SeasonMatchweekFixtures> {
  const { data, error } = await supabase.rpc('get_season_matchweek_card', {
    p_tournament_id: tournamentId,
    p_matchweek: matchweek,
  })
  if (error) throw error
  return mapSeasonMatchweekFixtures(data)
}
