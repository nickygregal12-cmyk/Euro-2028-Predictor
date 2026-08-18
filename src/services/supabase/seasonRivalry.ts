// Season rivalry query wrapper (contract 192's `get_season_rivalry`).
//
// ONE CALL FOR A WHOLE SEASON'S COMPARISON. Contract 129 answers one matchweek
// per call; this answers the season, bounded, in one. Stage 10's completion
// predicate requires exactly that ("H2H is weekly-season-shaped and bounded
// rather than one RPC per matchweek"), so this is the read a comparison
// surface uses, with contract 129 kept for drilling into a single matchweek's
// fixtures.
//
// THE SERVER OWNS THE PERMISSION, THE WINDOW AND THE BOUNDARY:
//
//   • contract 191's `reach` decides whether the comparison is allowed at all,
//     and whether the opponent's account id comes back with it;
//   • `p_recent` is clamped server-side to 1..20 and is NOT re-clamped here —
//     a second clamp is a second authority that disagrees the day one moves;
//   • only matchweeks SETTLED, REVEALED AND BANKED BY BOTH are compared,
//     because a matchweek the opponent could not play is not a win.
//
// IT REFUSES IN TWO WAYS AND THEY MEAN DIFFERENT THINGS:
//
//   • 42501 — contract 191 said `none`, or the caller holds no entry in this
//     season. About PERMISSION;
//   • no_data_found — the opponent holds no entry in this season. About THEM,
//     and a surface that reported "you may not compare" for it would accuse
//     the caller of lacking a permission that was never the problem.
//
// 22023 IS DELIBERATELY NOT TRANSLATED. The RPC raises it for a missing
// season, a season of the wrong kind AND a self-comparison; the message is the
// only distinguisher and a message is not a contract. Self-comparison is
// prevented structurally instead — Stage 9's `LeaguePlayerDestination` marks
// the caller's own row `you`, so no comparison intent can be formed against
// oneself. Anything else reaching here is an error and is thrown as one.
//
// This module never selects entries, standings, scores or predictions
// directly, and must not grow a fallback that does.

import { db } from './client'
import {
  OpponentNotEnteredError,
  RivalryNotPermittedError,
  mapSeasonRivalry,
  type SeasonRivalry,
} from './seasonRivalryModel'

export { OpponentNotEnteredError, RivalryNotPermittedError } from './seasonRivalryModel'
export type { SeasonRivalry } from './seasonRivalryModel'

function codeOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : ''
}

/**
 * Compare the caller with one other player across a season.
 *
 * @param opponentRef contract 191's season-scoped entry reference — NOT an
 * account id. The two are different identifiers and are never interchangeable.
 * @param recent how many recent compared matchweeks to return. Omit for the
 * server's default; the server clamps to 1..20 whatever is sent.
 */
export async function fetchSeasonRivalry(
  tournamentId: string,
  opponentRef: string,
  recent: number | null = null,
): Promise<SeasonRivalry> {
  const { data, error } = await db.rpc('get_season_rivalry', {
    p_tournament_id: tournamentId,
    p_opponent_ref: opponentRef,
    ...(recent === null ? {} : { p_recent: recent }),
  })

  if (error) {
    const code = codeOf(error)
    if (code === '42501' || code === 'insufficient_privilege') {
      throw new RivalryNotPermittedError()
    }
    if (code === 'no_data_found' || code === '02000') {
      throw new OpponentNotEnteredError()
    }
    throw error
  }

  return mapSeasonRivalry(data)
}
