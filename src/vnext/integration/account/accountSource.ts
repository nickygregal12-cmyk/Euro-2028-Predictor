import type { PlayerPreferences } from '../../../services/supabase/playerPreferencesModel'
import type { SeasonHistoryPage } from '../../../services/supabase/seasonHistoryModel'
import type { PublishedWeeklySeason } from '../../../services/supabase/weeklyCatalogueModel'
import type { PushNotificationState } from '../../../services/pushNotifications'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT ACCOUNT.
 *
 * ============================ THE READS, AND WHAT EACH IS FOR ============
 *
 *   contract 157  `get_my_preferences`            follows + favourite club ids
 *   contract 161  `get_my_season_history`         seasons this player PLAYED
 *   contract 147  `get_published_weekly_seasons`  the catalogue, used ONLY to
 *                                                 put a name on a follow
 *   `fetchMyAccount` + `getSessionEmailState`     the display name, the stored
 *                                                 reminder-email preference,
 *                                                 the email address and the one
 *                                                 awaiting confirmation
 *
 * Each arrives with its OWN outcome, for the reason every stage since 10 has
 * settled: a page assembled from several reads must not have a single
 * "loaded", because the reads do not succeed or fail together.
 *
 * ============================ 147 IS A NAMING AID, NOT A CATALOGUE =======
 *
 * This page does not show the catalogue — that is `/competitions`, and it is
 * its own row in the matrix. 147 is here for one job: contract 157 returns a
 * follow as a bare `tournamentId`, and something has to be able to say
 * "Premier League 2026/27" instead of a uuid.
 *
 * It is NOT sufficient for that job, and the model says so rather than the
 * mapper pretending. 147 lists what is PUBLISHED; 161 lists what was PLAYED. A
 * follow on an unpublished season the player never played is in neither, and
 * `FollowIdentity` has an `unnamed` case for exactly that player.
 *
 * ============================ WHAT IS NOT IN HERE =======================
 *
 * THE FAVOURITE CLUB'S NAME. Contract 157 carries the id and no name, and the
 * only read that resolves one is scoped to a single competition and sweeps a
 * fixture window besides. Fetching it per follow is the N+1 Stage 9 forbade, so
 * this type has no field for it and `buildAccountModel` has nothing to invent
 * one from.
 *
 * ============================ NOTHING HERE IS A CLOCK ====================
 *
 * `generatedAt` is supplied so the mapper stays pure.
 */

type PreferencesRead =
  | { readonly kind: 'ok'; readonly preferences: PlayerPreferences }
  | { readonly kind: 'failed' }

type HistoryRead =
  | { readonly kind: 'ok'; readonly history: SeasonHistoryPage }
  | { readonly kind: 'failed' }

/**
 * The catalogue's answer.
 *
 * `failed` is NOT propagated to a panel of its own, and that is deliberate:
 * this read decorates another read's rows. When it fails, follows still render
 * — as `unnamed`, which is a state the model already has for a reason that has
 * nothing to do with failure. One read failing must not empty a panel that
 * another read filled.
 */
type CatalogueRead =
  | { readonly kind: 'ok'; readonly seasons: readonly PublishedWeeklySeason[] }
  | { readonly kind: 'failed' }

/**
 * The profile row and the session's email state, which arrive together because
 * a single failure of either leaves the same panel unable to draw itself: an
 * email row with no address and a switch in an unknown position are not two
 * independently useful halves.
 *
 * `rules` ARE NUMBERS THE HOST READ FROM THE POLICY MODULE. They are carried
 * rather than imported because the policy lives in `src/features/`, which no
 * presentation module may reach, and because a second copy of a moderation list
 * is a second thing to keep in step.
 */
type SettingsRead =
  | {
      readonly kind: 'ok'
      readonly email: string | null
      readonly pendingEmail: string | null
      readonly reminderEmails: boolean
      readonly displayNameMaxLength: number
      readonly passwordMinLength: number
    }
  | { readonly kind: 'failed' }

export type AccountSource = {
  readonly generatedAt: string
  readonly displayName: string | null
  readonly preferences: PreferencesRead
  readonly history: HistoryRead
  readonly catalogue: CatalogueRead
  readonly settings: SettingsRead
  readonly pushNotifications: PushNotificationState | { readonly kind: 'unavailable' }
  /**
   * The deployment's configured administrator address as a ready `mailto:`, or
   * `null` where none is configured or the configured one is not an address.
   *
   * BUILT BY THE HOST, because the subject line names the product and the body
   * carries the player's own email — both of which are the application's facts.
   * A presentation module composing a support link would be inventing one.
   */
  readonly supportHref: string | null
}
