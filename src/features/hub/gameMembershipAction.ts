import { userFacingError } from '../../shared/errors/userFacingError'
import type { CompetitionGame } from '../../services/supabase/competitionGamesModel'

/**
 * What a player may do about one game's membership, and what to say when they
 * may not.
 *
 * WHY THIS EXISTS. The competition dashboard rendered a "Join game" button with
 * no handler at all: enabled, inviting, and doing nothing when pressed. A
 * control that silently fails is worse than an absent one, because the player
 * has no way to tell a broken button from a refused action. Every fact needed
 * to decide the action was already in `get_competition_games` and was being
 * thrown away by the decode layer.
 *
 * IT DECIDES FROM STORED FACTS, RESOLVED AGAINST THE SERVER'S INSTANT — the
 * registration window, `completed_at`, `availability_status`, `allow_rejoin`
 * and the caller's own membership row. The server enforces all of it again;
 * this exists so the interface stops offering actions that cannot succeed, not
 * to replace the enforcement.
 *
 * WHAT IT CANNOT KNOW, IT DOES NOT CLAIM. `leave_competition_game` also refuses
 * once a `bonus_score_events` row exists for the caller, and no browser read
 * exposes that. So leaving is offered on the facts available and its refusal is
 * reported honestly rather than predicted — which is the same boundary the
 * season Last Man Standing surface records, from the other side.
 */

/** Reachable through `GameMembershipDecision`; not exported separately, so it
 *  does not become a needless public name. */
type GameMembershipAction = 'join' | 'rejoin' | 'leave' | null

export type GameMembershipDecision = {
  action: GameMembershipAction
  /** The button's label, or null when no action is offered. */
  label: string | null
  /** Why no action is offered. Null when one is. */
  refusal: string | null
  /** True while the caller holds an active membership. */
  joined: boolean
}

function windowState(
  game: CompetitionGame,
  now: number,
): 'not_open' | 'closed' | 'open' {
  // Both bounds fail CLOSED on an absent or unreadable instant: the server
  // refuses a game with no opening instant on exactly that condition.
  const opens = game.registrationOpensAt ? new Date(game.registrationOpensAt).getTime() : null
  if (opens === null || Number.isNaN(opens) || opens > now) return 'not_open'

  const closes = game.registrationClosesAt
    ? new Date(game.registrationClosesAt).getTime()
    : null
  if (closes !== null && (Number.isNaN(closes) || closes <= now)) return 'closed'

  return 'open'
}

export function decideGameMembership(
  game: CompetitionGame,
  serverNow: string | null,
): GameMembershipDecision {
  const joined = game.membership?.status === 'active'
  const now = serverNow ? new Date(serverNow).getTime() : Number.NaN

  // Leaving first: an entrant's options do not depend on the registration
  // window, which is about getting in rather than getting out.
  if (joined) {
    if (game.completedAt !== null) {
      return {
        action: null,
        label: null,
        refusal: 'This game has finished. You stay in its final standings.',
        joined,
      }
    }
    return { action: 'leave', label: 'Leave game', refusal: null, joined }
  }

  if (game.membership?.status === 'disqualified') {
    return {
      action: null,
      label: null,
      refusal: 'Your entry was disqualified, so this game cannot be rejoined.',
      joined,
    }
  }

  if (game.completedAt !== null) {
    return {
      action: null,
      label: null,
      refusal: 'This game has finished, so it can no longer be joined.',
      joined,
    }
  }

  if (!game.active) {
    return {
      action: null,
      label: null,
      refusal: 'This game is not open for entry.',
      joined,
    }
  }

  const hasLeft = game.membership?.status === 'left'
  if (hasLeft && !game.allowRejoin) {
    return {
      action: null,
      label: null,
      refusal: 'You have left this game, and it cannot be rejoined.',
      joined,
    }
  }

  // Without a server instant the window cannot be resolved, and guessing with
  // the device clock is what this model exists to avoid.
  if (Number.isNaN(now)) {
    return {
      action: null,
      label: null,
      refusal: 'Entry could not be checked just now.',
      joined,
    }
  }

  switch (windowState(game, now)) {
    case 'not_open':
      return {
        action: null,
        label: null,
        refusal: 'Entry has not opened yet.',
        joined,
      }
    case 'closed':
      return {
        action: null,
        label: null,
        refusal: 'Entry has closed for this game.',
        joined,
      }
    default:
      return hasLeft
        ? { action: 'rejoin', label: 'Rejoin game', refusal: null, joined }
        : { action: 'join', label: 'Join game', refusal: null, joined }
  }
}

/**
 * Turn a join or leave refusal into the sentence that explains it.
 *
 * `55000` IS DELIBERATELY VAGUE, on both writes. Joining raises it for a
 * finished game, a window not yet open, a closed window, a disqualified entry
 * and a game that forbids rejoining; leaving raises it for a finished game,
 * scoring having started for the caller, and a Championship past its draw. The
 * code cannot tell those apart and the server's own message is never passed
 * through, so naming one would be a guess printed as fact. The dashboard
 * reloads after every attempt, and the reloaded facts are what explain it.
 */
const BY_CODE: Record<string, string> = {
  '23505': 'You are already in this game.',
  unique_violation: 'You are already in this game.',
  '55000': 'That change is not allowed right now.',
  '02000': 'This game is no longer available.',
  no_data_found: 'This game is no longer available.',
  '42501': 'Sign in to change your entry.',
  insufficient_privilege: 'Sign in to change your entry.',
}

export function gameMembershipRefusal(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code]
  return userFacingError(error)
}
