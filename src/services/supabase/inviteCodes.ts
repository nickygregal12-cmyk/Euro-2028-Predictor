import { db } from './client'
import {
  reportOperationFailure,
  serverCodeOf,
} from '../observability/operationFailure'
import { mapResolvedInvite, normaliseInviteCode, type ResolvedInvite } from './inviteCodesModel'

/**
 * The one invite-code entry point (contracts 153 and 155).
 *
 * RESOLVE THEN JOIN, ALWAYS IN THAT ORDER. `resolve_invite_code` is declared
 * `stable` and writes nothing, so a player can be shown what a code is before
 * they commit to it. Joining is a second, explicit call — which is why a
 * private competition cannot be entered by following a link alone.
 *
 * WHICH JOIN IS THE SERVER'S ANSWER. The resolver returns `joinWith`, and this
 * module dispatches on it rather than on anything the client inferred from the
 * code's shape. A league still goes through `join_league`, unchanged; a private
 * competition goes through `join_private_competition`, which is the only way to
 * enter one now that `join_competition_game` refuses a private container.
 */

export type {
  ResolvedCompetitionInvite,
  ResolvedInvite,
  ResolvedLeagueInvite,
  UnresolvedInvite,
} from './inviteCodesModel'
export { normaliseInviteCode } from './inviteCodesModel'

/**
 * What this code is, without joining anything.
 *
 * A code that resolves to nothing comes back `{ found: false }` rather than
 * throwing: it is a normal answer to a fair question, and the server has
 * already made unknown, malformed and rotated codes indistinguishable.
 */
export async function resolveInviteCode(code: string): Promise<ResolvedInvite> {
  const { data, error } = await db.rpc('resolve_invite_code', {
    p_code: normaliseInviteCode(code),
  })
  if (error) throw error
  return mapResolvedInvite(data)
}

export type JoinedPrivateCompetition = {
  gameCompetitionId: string | null
  gameKey: string | null
  status: string | null
}

/**
 * Enter a private competition with its code.
 *
 * Every membership rule — rejoin, disqualification, registration windows,
 * contract 126's running check — belongs to
 * `predictor_internal.enter_competition_game`, which both public join paths
 * call. Nothing is re-checked here, so the two paths cannot drift.
 */
export async function joinPrivateCompetition(
  code: string,
): Promise<JoinedPrivateCompetition> {
  const { data, error } = await db.rpc('join_private_competition', {
    p_code: normaliseInviteCode(code),
  })
  // `C1`. As with `join_league`, the code itself never leaves — it is the
  // credential, not the context.
  if (error) {
    reportOperationFailure('league.join', {
      outcome: 'failed',
      serverCode: serverCodeOf(error),
    })
    throw error
  }
  const row =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {}
  return {
    gameCompetitionId:
      typeof row.game_competition_id === 'string' ? row.game_competition_id : null,
    gameKey: typeof row.game_key === 'string' ? row.game_key : null,
    status: typeof row.status === 'string' ? row.status : null,
  }
}
