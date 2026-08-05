import { userFacingError } from '../../shared/errors/userFacingError'

/**
 * Turn a Last Man Standing write refusal into the sentence that explains it.
 *
 * WHY THIS EXISTS. `userFacingError` maps every unknown failure onto a small
 * set of safe static sentences, which is right — raw database, RPC and network
 * detail must never reach a player. But it means an LMS refusal arrives as
 * "Something went wrong. Please try again.", and these refusals are the
 * opposite of that: each one is a rule the player just met, and each has a
 * different thing to do about it. Being told to retry a pick that will be
 * refused every time is worse than useless.
 *
 * KEYED ON THE ERROR CODE, NEVER THE MESSAGE. The copy below is this
 * repository's, chosen here; the server's own message string is not passed
 * through. That keeps the rule (no raw detail escapes) while restoring the
 * distinction, and it is the same discipline `isVersionConflict` already uses
 * for PT409 — classify by code, then say something we wrote.
 *
 * A code this does not know falls back to `userFacingError`, so a new refusal
 * degrades to safe generic copy rather than to nothing.
 */

const BY_CODE: Record<string, string> = {
  // save_lms_selection: the club is already spent in this cycle.
  '23505': 'You have already used that club in this cycle. Pick another.',
  unique_violation: 'You have already used that club in this cycle. Pick another.',
  // The entrant is out; the round is read-only for them.
  '55000': 'You have been eliminated, so you cannot pick in this round.',
  // Not an entrant, or not authenticated.
  '42501': 'Join Last Man Standing to make a pick.',
  insufficient_privilege: 'Join Last Man Standing to make a pick.',
  // The window is not a live Last Man Standing round.
  '02000': 'That round is no longer available. Reload to see the current one.',
  no_data_found: 'That round is no longer available. Reload to see the current one.',
  // A pick with no club.
  '23514': 'Choose a club to pick.',
  check_violation: 'Choose a club to pick.',
}

export function lmsRefusal(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && BY_CODE[code]) return BY_CODE[code]
  return userFacingError(error)
}
