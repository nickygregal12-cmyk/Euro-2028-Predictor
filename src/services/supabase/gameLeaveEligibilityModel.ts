/**
 * Whether the caller may leave each live game in one competition season
 * (contract 140's `get_game_leave_eligibility`). Pure: no Supabase import, no
 * network, no clock.
 *
 * WHY THIS READ EXISTS AT ALL. `leave_competition_game` refuses once a
 * `bonus_score_events` row exists for the caller, and once a Championship draw
 * has placed them — and nothing exposed either fact. `gameMembershipAction`
 * says so in terms: leaving was offered on the facts available and its refusal
 * reported afterwards. That left the dashboard two bad options, render a
 * control the server will refuse or hide one that would have worked, and it
 * chose the first. This is the fact that lets it stop choosing.
 *
 * THE REASON VOCABULARY IS THE SERVER'S, THE SENTENCES ARE OURS. The read
 * returns a code — `not_entered`, `game_finished`, `scoring_started`,
 * `draw_completed`, `not_found` — and never a message, which is the same
 * discipline `lmsRefusal` applies to a write refusal. A code this does not know
 * is kept rather than dropped, so a new refusal degrades to "not right now"
 * with the code intact instead of silently reading as permission.
 *
 * IT CAN ONLY BE WRONG IN ONE DIRECTION, and the migration says why: every
 * branch mirrors the write, reading the same relations in the same order, so a
 * disagreement is a refusal the write would still enforce. It is never
 * permissive about one the write would not.
 */

export type LeaveRefusalCode =
  | 'not_found'
  | 'not_entered'
  | 'game_finished'
  | 'scoring_started'
  | 'draw_completed'

export type GameLeaveEligibility = {
  /** The `bonus_competitions` id, the same key `get_competition_games` returns. */
  id: string
  gameKey: string
  allowed: boolean
  /** Null exactly when `allowed`. A code, never a message. */
  reason: LeaveRefusalCode | string | null
}

export type SeasonLeaveEligibility = {
  serverNow: string | null
  games: readonly GameLeaveEligibility[]
}

const KNOWN: readonly string[] = [
  'not_found',
  'not_entered',
  'game_finished',
  'scoring_started',
  'draw_completed',
]

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function mapSeasonLeaveEligibility(payload: unknown): SeasonLeaveEligibility {
  const root = (payload ?? {}) as Record<string, unknown>
  const rows = Array.isArray(root.games) ? root.games : []

  return {
    serverNow: stringOrNull(root.server_now),
    games: rows.flatMap((value) => {
      const row = (value ?? {}) as Record<string, unknown>
      const id = stringOrNull(row.id)
      const gameKey = stringOrNull(row.game_key)
      // A row with no id cannot be matched to a game, so it can only be
      // misapplied to one. Dropped rather than guessed at.
      if (!id || !gameKey) return []
      const reason = stringOrNull(row.reason)
      return [
        {
          id,
          gameKey,
          // The server's own boolean, not `reason === null` re-derived here.
          // They agree by construction upstream and re-deriving would be a
          // second opinion that could disagree.
          allowed: row.allowed === true,
          reason,
        },
      ]
    }),
  }
}

/**
 * The sentence for a refusal code.
 *
 * `not_entered` HAS NO SENTENCE, deliberately: it is not a refusal a player
 * needs explaining, because somebody who has not joined is not being offered a
 * Leave control in the first place. Returning null keeps it out of the
 * interface rather than telling a non-entrant they cannot leave.
 */
export function leaveRefusalSentence(reason: string | null): string | null {
  switch (reason) {
    case null:
    case 'not_entered':
      return null
    case 'game_finished':
      return 'This game has finished. You stay in its final standings.'
    case 'scoring_started':
      return 'You have already scored in this game, so your entry stays in it.'
    case 'draw_completed':
      return 'The draw has been made, so leaving would change somebody else’s fixtures.'
    case 'not_found':
      return 'This game is no longer available.'
    default:
      // A refusal this build has not met. Said as an absence of permission
      // rather than as an error, because the server is refusing something real.
      return 'You cannot leave this game right now.'
  }
}

export function isKnownLeaveRefusal(reason: string | null): boolean {
  return reason !== null && KNOWN.includes(reason)
}
