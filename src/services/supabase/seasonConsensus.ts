// Season prediction consensus (contract 130's `get_season_prediction_consensus`).
//
// KEYED ON THE MATCHWEEK, WHICH IS THE WHOLE POINT. The tournament read counts
// a cohort of ten across one competition everybody is in. A season runs ~38
// rounds, and fifty entrants of whom six played matchweek 30 is exactly what
// contract 61's minimum exists to protect against — so the server counts the
// entries that predicted THAT round, not the season's membership.
//
// TWO REFUSALS ARE NOT ERRORS AND ARE NOT THE SAME AS EACH OTHER:
//
//   • before the matchweek locks, the read RAISES 42501. A consensus visible
//     while predictions are open would tell a player what everyone else picked
//     before they picked;
//   • with fewer than ten entries in that round it RETURNS `suppressed: true`
//     with the counts. That is a payload rather than a refusal, because the
//     surface can honestly say "not enough players yet" and how many are
//     needed, which "hidden" cannot.
//
// The decoder keeps both distinct. Collapsing them would put "come back after
// lock" in front of a player who is already past it.

import { supabase } from './client'
import {
  ConsensusHiddenError,
  mapSeasonConsensus,
  type SeasonConsensus,
} from './seasonConsensusModel'

export { ConsensusHiddenError } from './seasonConsensusModel'
export type {
  SeasonConsensus,
  SeasonConsensusFixture,
  ConsensusScoreline,
} from './seasonConsensusModel'

function isHidden(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === '42501' || code === 'insufficient_privilege'
}

export async function fetchSeasonConsensus(
  tournamentId: string,
  matchweek: number,
): Promise<SeasonConsensus> {
  const { data, error } = await supabase.rpc('get_season_prediction_consensus', {
    p_tournament_id: tournamentId,
    p_matchweek: matchweek,
  })
  if (error) {
    // 42501 also covers "you hold no entry in this season". Both mean the same
    // thing to this surface — there is nothing to show and nothing to retry —
    // and distinguishing them would mean the browser holding an opinion about
    // which server rule fired.
    if (isHidden(error)) throw new ConsensusHiddenError()
    throw error
  }
  return mapSeasonConsensus(data)
}
