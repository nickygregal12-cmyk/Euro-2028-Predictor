// Entry + prediction query wrappers. An "entry" is one user's set of
// predictions for a tournament (competition type is carried by entries in later
// tiers — see docs/competition-structure.md). v0.1 covers group match scores
// and the joker flag.

import { supabase } from './client'
import { VersionConflictError, isVersionConflict } from './writeConflict'

export type Entry = {
  id: string
  submittedAt: string | null
}

export type MatchPrediction = {
  matchId: string
  homeScore: number
  awayScore: number
  joker: boolean
  version: number
}

/** Fetch the user's entry for a tournament, creating it on first use. */
export async function getOrCreateEntry(userId: string, tournamentId: string): Promise<Entry> {
  const existing = await supabase
    .from('entries')
    .select('id, submitted_at')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    return { id: existing.data.id, submittedAt: existing.data.submitted_at }
  }

  const created = await supabase
    .from('entries')
    .insert({ user_id: userId, tournament_id: tournamentId })
    .select('id, submitted_at')
    .single()
  if (created.error) throw created.error
  return { id: created.data.id, submittedAt: created.data.submitted_at }
}

/**
 * Submit the entry via the server-side `submit_entry` function, which validates
 * completeness (all group matches predicted, a full 15-winner bracket) before
 * stamping submitted_at — the client is never trusted to gate submission.
 * Returns the (server) submission timestamp. Submission does not freeze the
 * entry; predictions stay editable until the real lock.
 */
export async function submitEntry(entryId: string): Promise<string> {
  const { data, error } = await supabase.rpc('submit_entry', { p_entry_id: entryId })
  if (error) throw error
  return data as string
}

export async function fetchMatchPredictions(entryId: string): Promise<MatchPrediction[]> {
  const { data, error } = await supabase
    .from('match_predictions')
    .select('match_id, home_score, away_score, joker, version')
    .eq('entry_id', entryId)
  if (error) throw error
  return (data ?? []).map((p) => ({
    matchId: p.match_id,
    homeScore: p.home_score,
    awayScore: p.away_score,
    joker: p.joker,
    version: p.version,
  }))
}

/**
 * Insert or update a single match prediction (keyed on entry + match). The
 * server remains the authority on locks; this write will be rejected by RLS /
 * lock enforcement once that lands, so callers must surface save failures.
 */
// Optimistic concurrency: `expectedVersion` is the version the client last read
// for this row (0 for a first write). The server's version trigger rejects a
// stale write with SQLSTATE 'PT409'; we surface that as VersionConflictError.
// Returns the new stored version for the caller to echo on its next write.
export async function upsertMatchPrediction(
  entryId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
  joker: boolean,
  expectedVersion: number,
): Promise<number> {
  const { data, error } = await supabase
    .from('match_predictions')
    .upsert(
      {
        entry_id: entryId,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        joker,
        version: expectedVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'entry_id,match_id' },
    )
    .select('version')
    .single()
  if (error) {
    if (isVersionConflict(error)) throw new VersionConflictError()
    throw error
  }
  return data.version
}

/**
 * Remove one saved score pair through the protected database boundary. A null
 * expected version means the client never read a row: the RPC returns false if
 * none exists, but raises PT409 if another device created one in the meantime.
 */
export async function deleteMatchPrediction(
  entryId: string,
  matchId: string,
  expectedVersion: number | null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_match_prediction', {
    p_entry_id: entryId,
    p_match_id: matchId,
    p_expected_version: expectedVersion,
  })
  if (error) {
    if (isVersionConflict(error)) throw new VersionConflictError()
    throw error
  }
  return data as boolean
}
