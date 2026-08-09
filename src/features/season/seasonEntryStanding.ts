import type { GameLeaveEligibility } from '../../services/supabase/gameLeaveEligibilityModel'

/**
 * Whether this competition runs a Match Predictor, and whether the caller is in
 * it.
 *
 * WHY THIS IS NEEDED AT ALL, and it was found by a browser rather than by
 * reasoning. `get_season_matchweek_card` does NOT refuse a non-entrant: its own
 * comment says "the read tolerates a missing entry (a player browsing before
 * joining sees an empty card); every write refuses". So the Match Centre keyed
 * its "you are not playing" branch on a 42501 that only fires when the caller
 * is unauthenticated, and for everybody else it rendered an ordinary card —
 * "Your prediction: None" — to a player who had never joined the game. That is
 * precisely the conflation the panel's own comment says it exists to avoid:
 * telling somebody who never entered that they left something blank.
 *
 * THE FACT COMES FROM CONTRACT 140, which already answers it. The leave
 * eligibility read returns one row per LIVE game with a refusal code, and
 * `not_entered` is exactly "you are not in this game". No new read; the one
 * batch F added for the Leave control answers this too.
 *
 * THREE STATES, BECAUSE THERE ARE THREE TRUTHS. A competition that runs no
 * Match Predictor at all is not the same as one that runs it and has not been
 * joined, and neither is the same as being in it. The eligibility read
 * distinguishes them by construction: it lists only the games a season
 * actually runs, so an absent row means the game is not offered here.
 *
 * PURE. The read is an input; no clock, no storage, no network.
 */

export type SeasonEntryStanding =
  /** The eligibility read has not answered. Say nothing rather than guess. */
  | 'unknown'
  /** This competition runs no Match Predictor. */
  | 'not_offered'
  /** It runs one, and the caller has not joined it. */
  | 'not_entered'
  /** The caller is in it. */
  | 'entered'

export function seasonEntryStanding(
  games: readonly GameLeaveEligibility[] | null,
): SeasonEntryStanding {
  if (games === null) return 'unknown'

  const predictor = games.find((game) => game.gameKey === 'main_predictor')
  // Absent from a read that lists every live game means the season does not
  // run one — not that the caller is outside it.
  if (!predictor) return 'not_offered'

  // `allowed` is about LEAVING, so it says nothing about entry on its own: an
  // entrant whose scoring has started is refused and is very much entered.
  // Only the reason `not_entered` speaks to membership.
  return predictor.reason === 'not_entered' ? 'not_entered' : 'entered'
}

/** The sentence for a caller with no entry behind this fixture. */
export function entryStandingLine(standing: SeasonEntryStanding): string | null {
  switch (standing) {
    case 'not_offered':
      return 'This competition does not run a Match Predictor, so this fixture has no prediction of yours behind it. The fixture and its result are the same for everyone following the season.'
    case 'not_entered':
      return 'You have not joined the Match Predictor in this competition, so this fixture has no prediction of yours behind it. You can join it from the competition’s games.'
    case 'entered':
    case 'unknown':
      return null
  }
}
