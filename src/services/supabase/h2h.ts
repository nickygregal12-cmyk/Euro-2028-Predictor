// Reveal-after-lock read of another player's entry (design-system §6 H2H). The
// gate — post-lock AND shared-league co-membership — lives in the security-
// definer function get_rival_entry (20260720170000_reveal_after_lock.sql), NOT
// here: a pre-lock or non-co-member call throws server-side. This wrapper only
// shapes the payload.

import { supabase } from './client'
import type { KnockoutStage } from '../../domain/tournament/scoringConfig'
import type { EntryPredictions } from '../../domain/tournament/h2h'

export type RivalEntry = {
  displayName: string
  totalPoints: number
  predictions: EntryPredictions
}

const STAGE_FROM_DB: Record<string, KnockoutStage> = {
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'FINAL',
  champion: 'CHAMPION',
}

/**
 * Fetch a rival's entry via the reveal endpoint. Throws if the server refuses
 * (pre-lock / not in a shared league / no entry) — callers surface that rather
 * than showing partial data.
 */
export async function fetchRivalEntry(rivalId: string, tournamentId: string): Promise<RivalEntry> {
  const { data, error } = await supabase.rpc('get_rival_entry', {
    p_rival_id: rivalId,
    p_tournament_id: tournamentId,
  })
  if (error) throw error
  const d = data as {
    display_name: string
    total_points: number
    group_matches: { match_id: string; home_score: number; away_score: number; joker: boolean }[]
    progression: { team_id: string; stage: string }[]
  }
  return {
    displayName: d.display_name,
    totalPoints: d.total_points,
    predictions: {
      groupMatches: (d.group_matches ?? []).map((m) => ({
        matchId: m.match_id,
        homeScore: m.home_score,
        awayScore: m.away_score,
        joker: Boolean(m.joker),
      })),
      progression: (d.progression ?? [])
        .map((p) => ({ teamId: p.team_id, stage: STAGE_FROM_DB[p.stage] }))
        .filter((p): p is { teamId: string; stage: KnockoutStage } => Boolean(p.stage)),
    },
  }
}
