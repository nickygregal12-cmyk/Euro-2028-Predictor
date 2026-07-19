// Entry + prediction query wrappers. An "entry" is one user's set of
// predictions for a tournament (competition type is carried by entries in later
// tiers — see docs/competition-structure.md). v0.1 covers group match scores
// and the joker flag.

import { supabase } from './client'

export type Entry = {
  id: string
  submittedAt: string | null
}

export type MatchPrediction = {
  matchId: string
  homeScore: number
  awayScore: number
  joker: boolean
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
    .select('match_id, home_score, away_score, joker')
    .eq('entry_id', entryId)
  if (error) throw error
  return (data ?? []).map((p) => ({
    matchId: p.match_id,
    homeScore: p.home_score,
    awayScore: p.away_score,
    joker: p.joker,
  }))
}

/**
 * Insert or update a single match prediction (keyed on entry + match). The
 * server remains the authority on locks; this write will be rejected by RLS /
 * lock enforcement once that lands, so callers must surface save failures.
 */
export async function upsertMatchPrediction(
  entryId: string,
  matchId: string,
  homeScore: number,
  awayScore: number,
  joker: boolean,
): Promise<void> {
  const { error } = await supabase.from('match_predictions').upsert(
    {
      entry_id: entryId,
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
      joker,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entry_id,match_id' },
  )
  if (error) throw error
}
