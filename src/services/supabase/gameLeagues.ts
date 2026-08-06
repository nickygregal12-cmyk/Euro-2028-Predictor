// Query wrappers for private leagues scoped to ONE GAME inside a competition.
//
// WHY THESE EXIST BESIDE `leagues.ts`. That module is the Euro tournament's,
// and its create/list calls take a tournament id: `create_league` picks a game
// for the caller (the Main or Original Predictor, in that order) and
// `get_my_leagues` returns every league in the season regardless of which game
// it belongs to. Both are compatibility shims kept for the tournament, and
// neither can express "this season's Main Predictor leagues" — which is what
// §7.3's Leagues section means inside a competition running several games.
// The game-scoped functions they delegate to have existed since the game
// catalogue landed and have never had a caller.
//
// JOINING IS NOT HERE, and that is not an omission. `join_league` resolves the
// game from the invite code itself and refuses a caller who has not joined that
// game, so it is already game-scoped and needs no variant; the season surface
// imports it from `leagues.ts` rather than growing a second wrapper for one
// RPC.

import { supabase } from './client'

export type GameLeague = {
  id: string
  name: string
  inviteCode: string
  memberCount: number
  isOwner: boolean
  ownerName: string
  lastActivityAt: string | null
}

export type CreatedGameLeague = { id: string; name: string; inviteCode: string }

function mapLeague(row: Record<string, unknown>): GameLeague {
  return {
    id: row.id as string,
    name: row.name as string,
    inviteCode: row.invite_code as string,
    memberCount: row.member_count as number,
    isOwner: row.is_owner as boolean,
    ownerName: row.owner_name as string,
    lastActivityAt: typeof row.last_activity_at === 'string' ? row.last_activity_at : null,
  }
}

/** The caller's leagues inside one game of one competition. */
export async function fetchMyGameLeagues(gameCompetitionId: string): Promise<GameLeague[]> {
  const { data, error } = await supabase.rpc('get_my_game_leagues', {
    p_game_competition_id: gameCompetitionId,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => mapLeague(row))
}

/**
 * Create a league inside one game. The server refuses a caller who holds no
 * active membership in that game, and mints the invite code itself.
 */
export async function createGameLeague(
  gameCompetitionId: string,
  name: string,
): Promise<CreatedGameLeague> {
  const { data, error } = await supabase.rpc('create_game_league', {
    p_game_competition_id: gameCompetitionId,
    p_name: name,
  })
  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) throw new Error('League creation returned no row')
  return { id: row.id, name: row.name, inviteCode: row.invite_code }
}
