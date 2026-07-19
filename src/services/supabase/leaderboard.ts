// Overall leaderboard query wrapper. Reading every submitted entry's display
// name + total is done through the `get_leaderboard` security-definer function
// (see 20260719170000_lock_and_leaderboard.sql) so the profiles/entries RLS
// stays tight — this module never selects those tables directly.

import { supabase } from './client'

export type LeaderboardRow = {
  displayName: string
  totalPoints: number
  isYou: boolean
}

/**
 * All submitted entries for a tournament, with display name, total points (0
 * until scoring lands) and whether the row is the current user's. Ranking is
 * applied in the pure domain (rankLeaderboard).
 */
export async function fetchLeaderboard(tournamentId: string): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  return (data ?? []).map((r: { display_name: string; total_points: number; is_you: boolean }) => ({
    displayName: r.display_name,
    totalPoints: r.total_points,
    isYou: r.is_you,
  }))
}
