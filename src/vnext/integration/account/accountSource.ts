import type { PlayerPreferences } from '../../../services/supabase/playerPreferencesModel'
import type { SeasonHistoryPage } from '../../../services/supabase/seasonHistoryModel'
import type { PublishedWeeklySeason } from '../../../services/supabase/weeklyCatalogueModel'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT ACCOUNT.
 *
 * ============================ THE READS, AND WHAT EACH IS FOR ============
 *
 *   contract 157  `get_my_preferences`            follows + favourite club ids
 *   contract 161  `get_my_season_history`         seasons this player PLAYED
 *   contract 147  `get_published_weekly_seasons`  the catalogue, used ONLY to
 *                                                 put a name on a follow
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
 * The session's email state and the profile's reminder preference.
 *
 * TWO READS, ONE PANEL, AND `failed` IS ONE ANSWER FOR BOTH. They are the two
 * halves of one settings block and neither is useful without the other — an
 * address with no preference beside it, or a preference with no address, is a
 * half-drawn panel that invites a player to change something they cannot see
 * the state of. `null` means the host did not load them at all.
 */
type AccountSettingsRead =
  | { readonly kind: 'failed' }
  | {
      readonly kind: 'ok'
      readonly email: string | null
      readonly pendingEmail: string | null
      readonly reminderEmails: boolean
    }

export type AccountSource = {
  readonly generatedAt: string
  readonly displayName: string | null
  readonly preferences: PreferencesRead
  readonly history: HistoryRead
  readonly catalogue: CatalogueRead
  /**
   * `/account`'s remaining settings. `null` is the host not having loaded them.
   *
   * THEY ARE HERE BECAUSE THE CUTOVER MAKES THIS PAGE `/account`. Stage 13
   * deferred both to their own stage, which was right at a stage boundary and
   * stops being right at the moment the legacy page they lived on is retired.
   */
  readonly settings: AccountSettingsRead | null
}
