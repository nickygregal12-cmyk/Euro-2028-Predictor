import { userFacingError } from '../../shared/errors/userFacingError'

/**
 * Turn a Penalty Number write refusal into the sentence that explains it.
 *
 * WHY THIS EXISTS, and it is `lmsRefusal.ts`'s reason unchanged:
 * `userFacingError` maps every unknown failure onto a small set of safe static
 * sentences, which is right — raw database, RPC and network detail must never
 * reach a player. But it means a refusal arrives as "Something went wrong.
 * Please try again.", and these refusals are the opposite of that: each is a
 * rule the player just met, and being told to retry a submission that will be
 * refused every time is worse than useless.
 *
 * KEYED ON THE ERROR CODE, NEVER THE MESSAGE. The copy below is this
 * repository's; the server's own message string is not passed through.
 *
 * ============================ ONE CODE, SEVERAL RULES — AND THIS MAP DOES
 * NOT PRETEND OTHERWISE ===================================================
 *
 * THE DIFFERENCE FROM `lmsRefusal.ts`, and the reason this file needed its own
 * thinking rather than a copy. There, each SQLSTATE meant one thing. Here
 * `submit_cup_penalty_number` raises:
 *
 *   `55000` for THREE different situations
 *     • the round has already been settled;
 *     • the round's real fixtures are not scheduled yet;
 *     • the Penalty Number locked at the first kickoff.
 *
 *   `check_violation` for THREE more
 *     • the value is not a whole number from 0 to 99;
 *     • the caller holds the ODD lane and submitted an even number;
 *     • the caller holds the EVEN lane and submitted an odd number.
 *
 * A map claiming to tell those apart would be inventing a distinction the code
 * does not carry. So each sentence below is chosen to be TRUE OF EVERY RULE
 * THAT SHARES ITS CODE, and the precise version is left to the surface, which
 * has better information than this error does: contract 193 already tells the
 * page the caller's `lane`, and whether the round is `locked` and `open`. The
 * page can state the lane rule BEFORE a submission rather than after a refusal.
 *
 * That is the honest split. Saying less here, and more where more is known.
 *
 * A code this does not know falls back to `userFacingError`, so a new refusal
 * degrades to safe generic copy rather than to nothing.
 */

const BY_CODE: Record<string, string> = {
  // Settled, unscheduled, or past the first kickoff. All three mean the round
  // will not take a submission and this page's view of it is stale, so the
  // sentence names that rather than guessing which of the three it was.
  '55000': 'This round is not taking Penalty Numbers. Reload to see where it stands.',
  // Out of range, or the wrong parity for the caller's lane. Both are about the
  // NUMBER, and the page knows the lane from the read.
  check_violation: 'That number is not allowed in your lane. Check the rule beside the box.',
  '23514': 'That number is not allowed in your lane. Check the rule beside the box.',
  // No tie in this round for this caller.
  no_data_found: 'You have no tie in this round.',
  '02000': 'You have no tie in this round.',
  // Not authenticated.
  insufficient_privilege: 'Sign in to submit a Penalty Number.',
  '42501': 'Sign in to submit a Penalty Number.',
}

/** The sentence this error's code maps to, or null when it maps to none. */
function refusalCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? BY_CODE[code] ?? null : null
}

export function championshipRefusal(error: unknown): string {
  const known = refusalCode(error)
  return known ?? userFacingError(error)
}

/**
 * WHETHER THIS IS A RULE THE PLAYER MET, RATHER THAN A FAULT.
 *
 * READS THE SAME MAP `championshipRefusal` DOES, which is the whole point of it
 * living here. A refusal means the caller's view is stale and re-reading is the
 * honest response; a fault means nothing changed and retrying is sensible. A
 * caller answering that with its own list of codes is a second authority that
 * drifts from this one the first time a refusal is added — and it drifts
 * SILENTLY, with the symptom being a player told to try again forever.
 *
 * Stage 11 shipped exactly that defect: a hook matching one SQLSTATE out of
 * five while a complete map already existed beside the write.
 *
 * `PT409` IS DELIBERATELY NOT HERE. A version conflict is neither a refusal nor
 * a fault — it is a lost race, resolved by re-reading — and
 * `isVersionConflict` is its one authority. Adding it here would be the second
 * copy this docblock exists to warn about.
 */
export function isChampionshipRefusal(error: unknown): boolean {
  return refusalCode(error) !== null
}
