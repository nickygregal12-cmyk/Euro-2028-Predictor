import { lazy, type ReactElement } from 'react'
import { useSite } from '../site/SiteProvider'
import { variantSurface, type VariantSurface } from '../site/variantRoutes'
import { weeklyRoutes } from '../shellRoutes'

/**
 * The four shared top-level paths, resolved to the product this build actually
 * is.
 *
 * WHY THE PATHS ARE SHARED AT ALL. ADR 0026 builds two deployments from one
 * commit, and both of them want `/`, `/play`, `/matches` and `/leagues` — those
 * are the four global destinations, and neither product should have to address
 * its own home as `/euro`. So the ADDRESS is shared and the SURFACE is not, and
 * this is the single place that turns one into the other.
 *
 * WHY IT IS NOT AN INLINE TERNARY IN `App.tsx`. Three reasons, in order of how
 * much they cost. First, the ownership becomes unreviewable: a branch in a route
 * table is one line and nobody can state afterwards what the two products differ
 * by, which is the exact failure `siteConfiguration.ts` was written to avoid.
 * Second, the coverage guards read `App.tsx` as source and understand
 * `element={<X />}`; an expression there makes the route invisible to them, so
 * the route silently loses its title check and its accessibility sweep. Third,
 * `variantRoutes.ts` can then be asserted as a table — every shared path owned in
 * both builds, and never by the same surface in both.
 *
 * THE TWO CANDIDATES ARE LAZY AND THE DISPATCHER IS NOT. That combination is
 * deliberate and was measured on the entry chunk's own ceiling: importing the
 * dispatcher lazily would put a second sequential dynamic import on the critical
 * path of the signed-in home, for a component that is nine lines. Keeping the
 * dispatcher static and both pages lazy means a Hub visitor downloads exactly the
 * Hub's home, a Euro visitor downloads exactly the Euro one, and neither pays a
 * round trip for the choice.
 *
 * IT DECIDES ADDRESSING AND NOTHING ELSE. Which surface a path is, per build. It
 * grants nothing, joins nothing and reveals nothing: the Euro surfaces below read
 * contract 143's publication state for themselves and fail closed, and the
 * tournament's own player routes remain behind `TournamentJourney`'s two gates.
 */

const HubPage = lazy(() =>
  import('../../features/hub/HubPage').then((m) => ({ default: m.HubPage })),
)
const GlobalPlayPage = lazy(() =>
  import('../../features/hub/GlobalPlayPage').then((m) => ({ default: m.GlobalPlayPage })),
)
const GlobalMatchesPage = lazy(() =>
  import('../../features/hub/GlobalMatchesPage').then((m) => ({ default: m.GlobalMatchesPage })),
)
const GlobalLeaguesPage = lazy(() =>
  import('../../features/hub/GlobalLeaguesPage').then((m) => ({ default: m.GlobalLeaguesPage })),
)
const EuroDestinationPage = lazy(() =>
  import('../../features/euro/EuroDestinationPage').then((m) => ({
    default: m.EuroDestinationPage,
  })),
)

/**
 * One surface identifier to one element.
 *
 * Exhaustive over `VariantSurface` by construction: adding a surface to the table
 * without adding it here fails the type check rather than falling through to a
 * default, because a default here would silently serve the wrong product.
 */
function render(surface: VariantSurface): ReactElement {
  switch (surface) {
    case 'hub-home':
      return <HubPage />
    case 'hub-play':
      return <GlobalPlayPage />
    case 'hub-matches':
      return <GlobalMatchesPage />
    case 'hub-leagues':
      return <GlobalLeaguesPage />
    case 'euro-home':
      return <EuroDestinationPage destination="home" />
    case 'euro-predict':
      return <EuroDestinationPage destination="play" />
    case 'euro-matches':
      return <EuroDestinationPage destination="matches" />
    case 'euro-leagues':
      return <EuroDestinationPage destination="leagues" />
  }
}

function Destination({ path }: { path: string }): ReactElement {
  const surface = variantSurface(useSite().variant, path)
  // Unreachable through the four exported components, which pass the same
  // constants the table is keyed on. It is here so a future caller that invents a
  // path gets the Hub's home rather than a blank screen — the same fail-closed
  // direction `useSite` takes when there is no provider.
  return render(surface ?? 'hub-home')
}

export function HomeDestination(): ReactElement {
  return <Destination path={weeklyRoutes.hub} />
}

export function PlayDestination(): ReactElement {
  return <Destination path={weeklyRoutes.play} />
}

export function MatchesDestination(): ReactElement {
  return <Destination path={weeklyRoutes.matches} />
}

export function LeaguesDestination(): ReactElement {
  return <Destination path={weeklyRoutes.leagues} />
}
