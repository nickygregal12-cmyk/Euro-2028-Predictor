// Query wrappers for bonus predictions + the golden-boot player search
// (scoring-rules §4). The group-stage total-goals bonus is NOT stored — it is
// derived from the entry's match predictions (see domain/groupGoals.ts) — so
// only the golden-boot player reference lives here.

import { supabase } from './client'
import { VersionConflictError, isVersionConflict } from './writeConflict'

export type Player = {
  id: string
  name: string
  teamId: string | null
}

export type GoldenBoot = {
  playerId: string | null
  version: number
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

/**
 * The saved golden-boot player id + row version for an entry. Version 0 when no
 * row exists yet (the first write INSERTs at 0), so the caller can echo it.
 */
export async function fetchGoldenBoot(entryId: string): Promise<GoldenBoot> {
  const { data, error } = await supabase
    .from('bonus_predictions')
    .select('golden_boot_player_id, version')
    .eq('entry_id', entryId)
    .maybeSingle()
  if (error) throw error
  return { playerId: data?.golden_boot_player_id ?? null, version: data?.version ?? 0 }
}

/**
 * Set (or clear, with null) the golden-boot player for an entry. Optimistic
 * concurrency: echoes `expectedVersion`, surfaces a version-conflict as
 * VersionConflictError, and returns the new stored version.
 */
export async function upsertGoldenBoot(
  entryId: string,
  playerId: string | null,
  expectedVersion: number,
): Promise<number> {
  const { data, error } = await supabase
    .from('bonus_predictions')
    .upsert(
      {
        entry_id: entryId,
        golden_boot_player_id: playerId,
        version: expectedVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entry_id' },
    )
    .select('version')
    .single()
  if (error) {
    if (isVersionConflict(error)) throw new VersionConflictError()
    throw error
  }
  return data.version
}
