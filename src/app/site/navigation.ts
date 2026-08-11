import type { GlobalNavTab } from '../shellRoutes'
import { weeklyRoutes } from '../weeklyRoutes'
import type { SiteConfiguration } from './siteConfiguration.js'

/**
 * The global destinations, as this site names and orders them.
 *
 * WHY THE TAB KEYS ARE THE SAME ON BOTH SITES. `globalNavTab()` resolves a
 * pathname to one of five tabs, and both products serve the same routes from
 * the same shared backend — a fixture is at `/matches` on either. What differs
 * is what the destination is CALLED and how prominent it is: the Euro site
 * leads with predicting the tournament, so its second destination reads
 * "Predict" rather than "Play". Renaming the keys as well would mean two route
 * models for one router, which is how deep links start resolving differently on
 * the two domains.
 *
 * `more` is not in the configuration because it is not a product decision: it
 * is the account, the rules and the profile, identical on both sites. Adding it
 * to the configuration would invite somebody to rename it per variant, which
 * would make "where are my settings" a different question on each domain.
 */
export type GlobalNavItem = {
  readonly key: GlobalNavTab
  readonly label: string
  readonly to: string
}

/** Routing keys in the order the four configured destinations are declared. */
const DESTINATION_TABS: Record<string, GlobalNavTab> = {
  home: 'home',
  play: 'predict',
  matches: 'matches',
  leagues: 'league',
}

export function globalNavItems(
  configuration: SiteConfiguration,
): readonly GlobalNavItem[] {
  const configured = configuration.navigation.destinations.flatMap((destination) => {
    const key = DESTINATION_TABS[destination.key]
    // An unrecognised destination is dropped rather than rendered without a
    // tab: a navigation entry that can never be the active one looks broken
    // every time the player is on it.
    return key ? [{ key, label: destination.label, to: destination.href }] : []
  })

  return [...configured, { key: 'more', label: 'More', to: weeklyRoutes.more }]
}
