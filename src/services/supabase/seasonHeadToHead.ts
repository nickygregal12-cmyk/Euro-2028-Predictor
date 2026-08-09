// Season head-to-head (contract 129's `get_season_head_to_head`).
//
// WHY IT HAD NO CALLER UNTIL NOW, which is worth stating because the read has
// been granted and hosted for days: it is addressed by an opponent's USER ID,
// and until this batch nothing in the browser held one. The public season
// leaderboard returns display names and no identifier at all; contract 128's
// private-league standings send `userId` and the decoder was dropping it. So
// the surface that can reach this is a private league's table — which is also
// the right place for it, since a head-to-head against a stranger from a
// public leaderboard is a different product question.
//
// THE READ REFUSES IN TWO WAYS AND THEY MEAN DIFFERENT THINGS:
//
//   • 42501 before the matchweek's own lock, or when the caller holds no entry.
//     Contract 129's boundary is the MATCHWEEK's lock rather than one
//     tournament instant, and it HIDES when a round's kickoffs are incomplete
//     rather than revealing — the safe direction;
//   • no_data_found when the opponent has not entered this season, which is
//     about them rather than about timing, and a surface that reported "come
//     back after the lock" for it would send a player to wait for something
//     that will never arrive.
//
// Both are states, not errors. Anything else is an error.

import { supabase } from './client'
import {
  HeadToHeadHiddenError,
  OpponentNotEnteredError,
  mapSeasonHeadToHead,
  type SeasonHeadToHead,
} from './seasonHeadToHeadModel'

export {
  HeadToHeadHiddenError,
  OpponentNotEnteredError,
} from './seasonHeadToHeadModel'
export type {
  SeasonHeadToHead,
  HeadToHeadFixture,
  HeadToHeadSide,
} from './seasonHeadToHeadModel'

function codeOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : ''
}

export async function fetchSeasonHeadToHead(
  tournamentId: string,
  opponentId: string,
  matchweek: number,
): Promise<SeasonHeadToHead> {
  const { data, error } = await supabase.rpc('get_season_head_to_head', {
    p_tournament_id: tournamentId,
    p_opponent_id: opponentId,
    p_matchweek: matchweek,
  })

  if (error) {
    const code = codeOf(error)
    if (code === '42501' || code === 'insufficient_privilege') {
      throw new HeadToHeadHiddenError()
    }
    if (code === 'no_data_found' || code === '02000') {
      throw new OpponentNotEnteredError()
    }
    throw error
  }

  return mapSeasonHeadToHead(data)
}
