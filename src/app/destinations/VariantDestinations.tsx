import { lazy, type ReactElement } from 'react'
import { Navigate } from 'react-router'
import { useSite } from '../site/SiteProvider'
import { variantSurface, type VariantSurface } from '../site/variantRoutes'
import { weeklyRoutes } from '../shellRoutes'
import { TournamentBoundary } from '../TournamentJourney'

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
 * The tournament's own surfaces at the shared addresses.
 *
 * WHY THEY ARE HERE AND NOT IN `App.tsx`. React Router registers one element per
 * path, and ADR 0026 gives `/play`, `/matches` and `/leagues` to a different
 * product on each build. So the Euro branch of this dispatcher is the only place
 * the tournament's matches, leagues and prediction entry can be reached at those
 * addresses at all. The tournament's OWN addresses — `/predict/**`, `/games/**`,
 * `/match/:matchRef` and the rest — stay in `App.tsx` under `TournamentJourney`,
 * because nothing on the Hub claims them and there is nothing to disambiguate.
 *
 * `TournamentBoundary` rather than the providers directly: it is the same two
 * gates, in the same order, from the same module `TournamentJourney` is built
 * from. Mounting `TournamentDataProvider` here instead would be a second answer
 * to "may this visitor see the tournament", and the second answer is the one
 * that goes wrong.
 */
const TournamentMatchesPage = lazy(() =>
  import('../../features/matches/MatchesPage').then((m) => ({ default: m.MatchesPage })),
)
const TournamentLeaguePage = lazy(() =>
  import('../../features/league/LeaguePage').then((m) => ({ default: m.LeaguePage })),
)
const TournamentPredictEntryPage = lazy(() =>
  import('../../features/predict/PredictEntryPage').then((m) => ({
    default: m.PredictEntryPage,
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
    // `/` STAYS OUTSIDE THE BOUNDARY, and that is load-bearing rather than an
    // omission. Both variants set `routes.signedInHome: '/'`, so a boundary that
    // redirects an unpublished tournament to its signed-in home would redirect
    // `/` to `/` for ever. The Euro home is the state-aware page, which fails
    // closed and says so, and it is what the redirect target has to be.
    case 'euro-home':
      return <EuroDestinationPage destination="home" />
    // The other three are the tournament, behind its own two gates, falling back
    // to exactly the closed-state page they used to render unconditionally.
    case 'euro-predict':
      return (
        <TournamentBoundary closed={<EuroDestinationPage destination="play" />}>
          <TournamentPredictEntryPage />
        </TournamentBoundary>
      )
    case 'euro-matches':
      return (
        <TournamentBoundary closed={<EuroDestinationPage destination="matches" />}>
          <TournamentMatchesPage />
        </TournamentBoundary>
      )
    case 'euro-leagues':
      return (
        <TournamentBoundary closed={<EuroDestinationPage destination="leagues" />}>
          <TournamentLeaguePage />
        </TournamentBoundary>
      )
    case 'hub-leagues-redirect':
      return <Navigate to={weeklyRoutes.leagues} replace />
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

/**
 * `/league`, singular — a redirect on the Hub and the tournament's own Leagues
 * page on the Euro build. See the row for it in `variantRoutes.ts`.
 */
export function SingularLeagueDestination(): ReactElement {
  return <Destination path="/league" />
}
