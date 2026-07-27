import { supabase } from './client'

export type ConfirmGroupResultInput = {
  matchId: string
  homeScore: number
  awayScore: number
}

export async function confirmGroupMatchResult(
  input: ConfirmGroupResultInput,
): Promise<void> {
  const { error } = await supabase.rpc('admin_confirm_match_result', {
    p_match_id: input.matchId,
    p_method: 'normal',
    p_home_90: input.homeScore,
    p_away_90: input.awayScore,
    p_home_120: null,
    p_away_120: null,
    p_home_penalties: null,
    p_away_penalties: null,
    p_reason: null,
  })

  if (error) throw error
}
