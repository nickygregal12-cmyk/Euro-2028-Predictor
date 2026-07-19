// Query wrappers for bonus predictions + the golden-boot player search
// (scoring-rules §4). The group-stage total-goals bonus is NOT stored — it is
// derived from the entry's match predictions (see domain/groupGoals.ts) — so
// only the golden-boot player reference lives here.

import { supabase } from './client'

export type Player = {
  id: string
  name: string
  teamId: string | null
}

/**
 * Search squad players by name or team. The players table is seeded empty until
 * squads are confirmed post-draw, so this returns [] for now — the picker shows
 * an honest empty state. UI is final; only the data is pending.
 */
export async function searchPlayers(
  tournamentId: string,
  query: string,
  limit = 20,
): Promise<Player[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('tournament_id', tournamentId)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, teamId: p.team_id }))
}

/** The saved golden-boot player id for an entry, or null if none / not set. */
export async function fetchGoldenBoot(entryId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bonus_predictions')
    .select('golden_boot_player_id')
    .eq('entry_id', entryId)
    .maybeSingle()
  if (error) throw error
  return data?.golden_boot_player_id ?? null
}

/** Set (or clear, with null) the golden-boot player for an entry. */
export async function upsertGoldenBoot(entryId: string, playerId: string | null): Promise<void> {
  const { error } = await supabase.from('bonus_predictions').upsert(
    {
      entry_id: entryId,
      golden_boot_player_id: playerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entry_id' },
  )
  if (error) throw error
}
