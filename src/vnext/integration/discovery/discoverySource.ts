import type { PlayerPreferences } from '../../../services/supabase/playerPreferencesModel'
import type { PublishedWeeklySeason } from '../../../services/supabase/weeklyCatalogueModel'

/**
 * WHAT THE REAL APPLICATION HANDS vNEXT DISCOVERY.
 *
 *   contract 147  `get_published_weekly_seasons`  the platform's catalogue
 *   contract 157  `get_my_preferences`            what this player follows
 *
 * ============================ THEY FAIL DIFFERENTLY, AND IT MATTERS =====
 *
 * The catalogue failing empties the page: there is nothing to discover. The
 * preferences failing does NOT — the platform's published seasons are not
 * private to the player, so the catalogue still renders.
 *
 * But it renders with the follow state UNKNOWN, and unknown is modelled rather
 * than defaulted to "not following". The default would be actively harmful
 * here: `set_competition_follow` upserts, so offering Follow for a competition
 * the player already follows clears their favourite club.
 */

type CatalogueRead =
  | { readonly kind: 'ok'; readonly seasons: readonly PublishedWeeklySeason[] }
  | { readonly kind: 'failed' }

type PreferencesRead =
  | { readonly kind: 'ok'; readonly preferences: PlayerPreferences }
  | { readonly kind: 'failed' }

export type DiscoverySource = {
  readonly generatedAt: string
  readonly catalogue: CatalogueRead
  readonly preferences: PreferencesRead
}
