// Query wrappers for manual tie-resolutions (the user's chosen order for a set
// of teams the automatic criteria couldn't separate — scoring-rules §6 step 7).
// Keyed per entry by the canonical set-key; the domain layer re-validates each
// stored order against the currently-tied set, so stale rows are harmless.

import { supabase } from './client'
import { tieKey } from '../../domain/tournament/tieResolutions'

export type TieResolutionScope = 'group' | 'third'

export type StoredTieResolution = {
  scope: TieResolutionScope
  teamIds: string[] // the tied set (as stored order; the key is set-based)
  order: string[] // the user's chosen finishing order, best first
}

export async function fetchTieResolutions(entryId: string): Promise<StoredTieResolution[]> {
  const { data, error } = await supabase
    .from('predicted_tie_resolutions')
    .select('scope, ordered_team_ids')
    .eq('entry_id', entryId)
  if (error) throw error
  return (data ?? []).map((r) => ({
    scope: r.scope as TieResolutionScope,
    teamIds: r.ordered_team_ids,
    order: r.ordered_team_ids,
  }))
}

/**
 * Insert or update the ordering for one tie (keyed on entry + tie set). The
 * server stays the authority on locks; once lock enforcement lands this write
 * is rejected after kickoff, so callers must surface save failures.
 */
export async function upsertTieResolution(
  entryId: string,
  scope: TieResolutionScope,
  orderedTeamIds: string[],
): Promise<void> {
  const { error } = await supabase.from('predicted_tie_resolutions').upsert(
    {
      entry_id: entryId,
      scope,
      tie_key: tieKey(orderedTeamIds),
      ordered_team_ids: orderedTeamIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entry_id,tie_key' },
  )
  if (error) throw error
}
