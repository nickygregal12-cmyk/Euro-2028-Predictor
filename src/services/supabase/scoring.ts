// Query wrapper for the current user's scored events (the "My points" view).
// score_events RLS limits reads to the caller's own entry, so a plain select
// returns only their events. The stored totals reach other users only through
// the leaderboard functions (see 20260720130000_add_scoring.sql).

import { supabase } from './client'
import type { ScoreCategory, ScoreEvent } from '../../domain/tournament/scoreEvents'

/**
 * The caller's score events, mapped to the canonical ScoreEvent shape the Points
 * breakdown renders. Flags aren't stored (teams are placeholders until the draw);
 * the explanation already names the teams. Ordered by category then time.
 */
export async function fetchMyScoreEvents(): Promise<ScoreEvent[]> {
  const { data, error } = await supabase
    .from('score_events')
    .select('id, category, points, joker, explanation, created_at')
    .order('category')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as ScoreCategory,
    explanation: r.explanation as string,
    points: r.points as number,
    joker: (r.joker as boolean) || undefined,
  }))
}

export type ScoreEventPoints = { matchId: string | null; points: number }

/**
 * The caller's score-event points keyed by the match they scored (null for
 * non-match categories). Feeds Home's "Points Today" (sum where the match is
 * today) — the sum of all rows also equals the user's total. RLS scopes to the
 * caller's own entry.
 */
export async function fetchMyScoreEventPoints(): Promise<ScoreEventPoints[]> {
  const { data, error } = await supabase.from('score_events').select('match_id, points')
  if (error) throw error
  return (data ?? []).map((r) => ({
    matchId: (r.match_id as string | null) ?? null,
    points: r.points as number,
  }))
}
