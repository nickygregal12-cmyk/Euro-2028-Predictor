// Whether the caller may leave each live game in one competition season
// (contract 140's `get_game_leave_eligibility`).
//
// A SECOND READ BESIDE `get_competition_games`, AND THE MIGRATION EXPLAINS WHY
// IT IS NOT PART OF IT: widening the existing function is the better shape on
// paper, and the attempt silently dropped its nested fixtures array, because
// `create or replace` restates the whole body. So this adds a fact and can
// remove none.
//
// The two reads join on `id`, which is the same `bonus_competitions` id both
// return. Nothing here re-derives a refusal — the write remains the authority
// and this only reports what it would say.

import { db } from './client'
import {
  mapSeasonLeaveEligibility,
  type SeasonLeaveEligibility,
} from './gameLeaveEligibilityModel'

export type { SeasonLeaveEligibility, GameLeaveEligibility } from './gameLeaveEligibilityModel'

export async function fetchSeasonLeaveEligibility(
  tournamentId: string,
): Promise<SeasonLeaveEligibility> {
  const { data, error } = await db.rpc('get_game_leave_eligibility', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapSeasonLeaveEligibility(data)
}
