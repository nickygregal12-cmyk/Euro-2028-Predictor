// Recent club form and this season's meetings between two clubs (contract 141).
//
// DERIVE-OURSELVES WORK, IN THE ENRICHMENT PLAN'S TERMS. Both reads are built
// from settled season fixtures alone, which contract 135 made possible by
// producing results at all, and neither costs a provider request. The migration
// guards that neither may name a prediction, an entry or a score event.
//
// THE FORM READ IS PER SEASON, NOT PER CLUB. It returns every club in one call,
// so a surface showing two clubs makes one request rather than two, and a
// surface showing twenty makes the same one.

import { db } from './client'
import {
  mapClubHeadToHead,
  mapSeasonClubForm,
  type ClubHeadToHead,
  type SeasonClubFormTable,
} from './seasonClubFormModel'

export type {
  SeasonClubForm,
  SeasonClubFormTable,
  ClubHeadToHead,
  ClubMeeting,
  ClubFormOutcome,
} from './seasonClubFormModel'

export async function fetchSeasonClubForm(
  tournamentId: string,
  matches?: number,
): Promise<SeasonClubFormTable> {
  const { data, error } = await db.rpc('get_season_club_form', {
    p_tournament_id: tournamentId,
    // Omitted lets the server keep its own default and its own bounds. A
    // browser holding a copy of the cap is one that will disagree with it.
    //
    // This now omits the argument, which is what the sentence above always
    // claimed. It previously sent an explicit `null`, which happened to reach
    // the same answer only because `20260809110000_season_club_form.sql:125`
    // reads `least(greatest(coalesce(p_matches, 6), 1), 20)` — the server's
    // default is applied by a `coalesce` rather than by the argument default.
    // Behaviour is unchanged; the code and its comment now agree.
    ...(matches === undefined ? {} : { p_matches: matches }),
  })
  if (error) throw error
  return mapSeasonClubForm(data)
}

export async function fetchSeasonClubHeadToHead(
  tournamentId: string,
  teamId: string,
  opponentId: string,
): Promise<ClubHeadToHead> {
  const { data, error } = await db.rpc('get_season_club_head_to_head', {
    p_tournament_id: tournamentId,
    p_team_id: teamId,
    p_opponent_id: opponentId,
  })
  if (error) throw error
  return mapClubHeadToHead(data)
}
