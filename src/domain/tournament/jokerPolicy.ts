// Pure joker placement/commitment policy (scoring-rules §1). Data in, data out;
// no UI, no database access. This MIRRORS the server-side rules (max 5 jokers
// per entry, and the per-match kickoff-commitment lock) so the UI can reflect
// them — but the database is the authority (see the joker-enforcement
// migration). The UI must never be the sole guard.
//
// Note: the joker-commitment lock is independent of the score lock. Scores lock
// at the opening match's kickoff; a joker instead commits at the kickoff of the
// match it sits on, and until then it can be freely moved between not-yet-
// kicked-off matches — even during the tournament.

import { JOKER_ALLOWANCE } from './scoringConfig'

/**
 * A joker is committed (consumed, frozen) once its match has kicked off. A match
 * with no confirmed kickoff time (kickoffAt null, pre-draw) is never committed.
 */
export function isJokerCommitted(kickoffAt: string | null, now: Date = new Date()): boolean {
  if (!kickoffAt) return false
  return new Date(kickoffAt).getTime() <= now.getTime()
}

export type JokerToggleReason = 'committed' | 'max'

/**
 * Whether the user may toggle the joker on one match right now.
 * - Rejected as 'committed' once the match has kicked off — in both directions:
 *   you can neither place a joker on a kicked-off match nor remove a committed
 *   one (it's spent).
 * - Rejected as 'max' when turning a joker ON would exceed the five-joker
 *   allowance. `otherJokerCount` is the number of jokers already placed on OTHER
 *   matches, so turning this match's joker off (or leaving it on) never trips it.
 */
export function canToggleJoker(params: {
  turningOn: boolean
  otherJokerCount: number
  kickoffAt: string | null
  now?: Date
}): { allowed: boolean; reason?: JokerToggleReason } {
  const now = params.now ?? new Date()
  if (isJokerCommitted(params.kickoffAt, now)) return { allowed: false, reason: 'committed' }
  if (params.turningOn && params.otherJokerCount >= JOKER_ALLOWANCE) {
    return { allowed: false, reason: 'max' }
  }
  return { allowed: true }
}
