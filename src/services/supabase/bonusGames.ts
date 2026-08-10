import { db } from './client'
import { mapBonusGamesResponse, type BonusGamesRead } from './bonusGamesModel'

/**
 * Reads the Games hub: every published bonus competition for the tournament
 * with the caller's own entrant state, windows and real-fixture facts, plus
 * the server instant the browser resolves states against. Bounded server-side.
 */
export async function fetchBonusGames(
  tournamentId: string,
  userId: string,
): Promise<BonusGamesRead> {
  const { data, error } = await db.rpc('get_bonus_games', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return mapBonusGamesResponse(data, tournamentId, userId)
}

/** Voluntary entry into one bonus competition. The database owns every boundary. */
export async function registerBonusCompetition(competitionId: string): Promise<void> {
  const { error } = await db.rpc('register_bonus_competition', {
    p_competition_id: competitionId,
  })
  if (error) throw error
}

/** Withdrawal from one bonus competition; refused server-side once scored. */
export async function withdrawBonusCompetition(competitionId: string): Promise<void> {
  const { error } = await db.rpc('withdraw_bonus_competition', {
    p_competition_id: competitionId,
  })
  if (error) throw error
}
