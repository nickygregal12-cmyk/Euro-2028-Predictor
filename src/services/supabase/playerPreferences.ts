import { db } from './client'
import { rpcArgs } from './rpcArguments'
import {
  mapPlayerPreferences,
  storedOnboardingStep,
  type PlayerPreferences,
} from './playerPreferencesModel'

/**
 * Query wrappers for contract 157's preference authority.
 *
 * FOUR FUNCTIONS, ONE ROW TRIP FOR THE READ. Every write returns the server's
 * own confirmation rather than a boolean this file invented, and callers are
 * expected to re-read (or reconcile) rather than assume: a follow that the
 * server refused must not appear on the Hub because the browser optimistically
 * decided it worked.
 *
 * NO RULE LIVES HERE. Which team may be a favourite, who may be pinned and when
 * completion is stamped are all the migration's, enforced server-side. This
 * module carries the call and the decode and nothing else.
 */

export type {
  FollowedCompetition,
  OnboardingProgress,
  PinnedRival,
  PlayerPreferences,
} from './playerPreferencesModel'
export {
  EMPTY_PREFERENCES,
  favouriteTeamFor,
  isFollowing,
  pinnedRivalsFor,
} from './playerPreferencesModel'

/** Everything the signed-in player has chosen: onboarding, follows, rivals. */
export async function fetchPlayerPreferences(): Promise<PlayerPreferences> {
  const { data, error } = await db.rpc('get_my_preferences')
  if (error) throw error
  return mapPlayerPreferences(data)
}

/**
 * Follow or unfollow a competition, optionally naming a favourite club.
 *
 * `favouriteTeamId` is sent as NULL rather than omitted when the player has no
 * favourite, because omitting it would leave the argument at its default and
 * the server would keep a club the player has just cleared. NULL is the
 * specified "no favourite" input; `rpcArgs` is what lets the generated type
 * say so.
 */
export async function setCompetitionFollow(
  tournamentId: string,
  following: boolean,
  favouriteTeamId: string | null = null,
): Promise<void> {
  const { error } = await db.rpc(
    'set_competition_follow',
    rpcArgs('set_competition_follow', ['p_favourite_team_id'], {
      p_tournament_id: tournamentId,
      p_following: following,
      p_favourite_team_id: favouriteTeamId,
    }),
  )
  if (error) throw error
}

/**
 * Record where onboarding got to.
 *
 * Progress is written as the player moves, not only at the end, so a session
 * abandoned at step three resumes at step three. `completed` is the server's
 * one-way stamp: passing it again later never rewrites when they first
 * finished.
 *
 * THE STEP IS TRANSLATED, because `profiles.onboarding_step` accepts four
 * values and the journey names its steps differently — see
 * `storedOnboardingStep` for why the mapping lives at this boundary. A step the
 * column would reject is refused HERE, by name, rather than sent and answered
 * with a bare 400: a CHECK violation reaches the browser as an unexplained
 * failure, and this is the layer that knows what went wrong.
 */
export async function setOnboardingProgress(
  step: string,
  completed = false,
): Promise<void> {
  const stored = storedOnboardingStep(step)
  if (stored === null) {
    throw new Error(`Onboarding step "${step}" is not one the server stores.`)
  }
  const { error } = await db.rpc('set_onboarding_progress', {
    p_step: stored,
    p_completed: completed,
  })
  if (error) throw error
}

/**
 * Pin or unpin a rival in one competition.
 *
 * The server refuses anyone the caller does not share a private league with —
 * contract 151's boundary, reused rather than re-decided — so a refusal here is
 * a real answer and must be surfaced, never swallowed into a silent no-op.
 */
export async function setPinnedRival(
  tournamentId: string,
  rivalUserId: string,
  pinned = true,
): Promise<void> {
  const { error } = await db.rpc('set_pinned_rival', {
    p_tournament_id: tournamentId,
    p_rival_user_id: rivalUserId,
    p_pinned: pinned,
  })
  if (error) throw error
}
