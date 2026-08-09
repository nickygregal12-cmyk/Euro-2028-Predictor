import { Outlet } from 'react-router'
import { TournamentDataProvider } from './providers/TournamentDataProvider'
import { PredictionsProvider } from './providers/PredictionsProvider'

/**
 * The boundary the Euro tournament's data lives behind.
 *
 * BOTH PROVIDERS USED TO SIT ABOVE THE WHOLE SIGNED-IN SHELL. That was correct
 * when every signed-in route was a tournament route. It stopped being correct
 * when this became a multi-competition platform, and nothing moved: a player who
 * follows only the Scottish Premiership still fetched the entire Euro 2028
 * dataset — teams, matches, results, their own entry — on every page load and
 * again on every return to the foreground, for a competition whose surfaces they
 * can no longer reach at all. Work done for nobody, on the critical path of
 * every render, paid on a phone.
 *
 * So the providers mount as a route layout instead, wrapping exactly the routes
 * that consume them. Everything else — the Hub, every `/competitions/**` season
 * surface, More — mounts neither and asks the tournament nothing.
 *
 * `tests/app/tournamentDataBoundary.test.ts` walks the real import graph from
 * each registered route and fails if the two sets disagree in either direction:
 * a tournament consumer registered outside the boundary would throw on mount
 * ("useTournamentData must be used within a TournamentDataProvider"), and a
 * route inside it that reaches no tournament data has silently put the fetch
 * back on a domestic journey.
 *
 * WHAT THIS IS NOT. It does not make `/profile`, `/account` or `/league/:id`
 * domestic — they still answer for the Euro tournament and only for it, which is
 * a genuine gap recorded against `EURO-001`, not something a provider move
 * closes. It stops that gap from being charged to every other route.
 */
export function TournamentJourney() {
  return (
    <TournamentDataProvider>
      <PredictionsProvider>
        <Outlet />
      </PredictionsProvider>
    </TournamentDataProvider>
  )
}
