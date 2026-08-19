import { db } from './client'
import { mapSeasonCupBracket, type SeasonCupBracket } from './seasonCupBracketModel'

/**
 * Query wrapper for contract 193's `get_season_cup_bracket`.
 *
 * SPLIT FROM THE DECODER for the reason `seasonLmsField.ts` is split from
 * `seasonLmsFieldModel.ts`: importing `./client` requires Supabase
 * configuration, so a decoder that lived here could not be unit-tested without
 * it. The mapping is the part with the surprises in it, and it belongs
 * somewhere a test can reach.
 */
export type { CupBracketSeat, CupSeatSide, SeasonCupBracket } from './seasonCupBracketModel'

export async function fetchSeasonCupBracket(competitionId: string): Promise<SeasonCupBracket> {
  const { data, error } = await db.rpc('get_season_cup_bracket', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return mapSeasonCupBracket(data)
}
