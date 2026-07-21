// Query wrappers for predicted_progression (the winner-only knockout picks:
// per team, the furthest stage the user predicts it reaches). Keyed per entry
// by team. The domain reconstructs the full bracket from these rows, so a stale
// row for a team that no longer qualifies is harmless — it simply won't render.

import { supabase } from './client'
import type { ProgressionStage } from '../../domain/tournament/bracketPicks'
import { VersionConflictError, isVersionConflict } from './writeConflict'

export type StoredProgression = {
  teamId: string
  stage: ProgressionStage
  version: number
}

export async function fetchProgression(entryId: string): Promise<StoredProgression[]> {
  const { data, error } = await supabase
    .from('predicted_progression')
    .select('team_id, stage, version')
    .eq('entry_id', entryId)
  if (error) throw error
  return (data ?? []).map((r) => ({
    teamId: r.team_id,
    stage: r.stage as ProgressionStage,
    version: r.version,
  }))
}

/**
 * Insert or update one team's furthest predicted stage (keyed on entry + team).
 * The server stays the authority on locks; once lock enforcement lands this
 * write is rejected after kickoff, so callers must surface save failures.
 */
// Optimistic concurrency (per team row): echoes `expectedVersion`, surfaces the
// server's version-conflict as VersionConflictError, returns the new version.
export async function upsertProgression(
  entryId: string,
  teamId: string,
  stage: ProgressionStage,
  expectedVersion: number,
): Promise<number> {
  const { data, error } = await supabase
    .from('predicted_progression')
    .upsert(
      {
        entry_id: entryId,
        team_id: teamId,
        stage,
        version: expectedVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entry_id,team_id' },
    )
    .select('version')
    .single()
  if (error) {
    if (isVersionConflict(error)) throw new VersionConflictError()
    throw error
  }
  return data.version
}

/** Remove a team's progression row (it no longer wins any knockout match). */
export async function deleteProgression(entryId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('predicted_progression')
    .delete()
    .eq('entry_id', entryId)
    .eq('team_id', teamId)
  if (error) throw error
}
