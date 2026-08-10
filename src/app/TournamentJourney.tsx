import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { AuthSplash } from '../features/auth/AuthSplash'
import {
  fetchEuroPublicationState,
  type EuroPublicationSnapshot,
} from '../services/supabase/euroPublication'
import { TournamentDataProvider } from './providers/TournamentDataProvider'
import { PredictionsProvider } from './providers/PredictionsProvider'

export type TournamentJourneyProps = {
  /** Injectable so the publication gate is proven without mocking Supabase. */
  readPublicationState?: () => Promise<EuroPublicationSnapshot>
}

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
 * EURO-004 ADDS THE CONTROL THAT CATALOGUE OMISSION COULD NOT PROVIDE. Before a
 * player-only Euro route mounts either provider, Contract 143's bounded server
 * read must say the tournament is no longer `hidden`. A failed or malformed read
 * also refuses, so publication fails closed instead of turning an outage into an
 * accidental launch. This is a route control, not a second visibility rule: the
 * state comes from the one server authority and this component only consumes it.
 *
 * The authorised `/admin/results` preparation path is deliberately exempt. A
 * hidden tournament still has to be prepared before its owner can publish it;
 * hiding player routes must not remove the results workspace needed to reach a
 * publishable state. The admin route remains protected independently by
 * `RequireAdmin` in `App.tsx`.
 */
export function TournamentJourney({
  readPublicationState = fetchEuroPublicationState,
}: TournamentJourneyProps) {
  const location = useLocation()
  const isAdminPreparation = location.pathname === '/admin/results'
  const [published, setPublished] = useState<boolean | null>(isAdminPreparation ? true : null)

  useEffect(() => {
    if (isAdminPreparation) {
      setPublished(true)
      return
    }

    let active = true
    setPublished(null)

    readPublicationState()
      .then((snapshot) => {
        if (active) setPublished(snapshot.state !== 'hidden')
      })
      .catch(() => {
        if (active) setPublished(false)
      })

    return () => {
      active = false
    }
  }, [isAdminPreparation, readPublicationState])

  if (published === null) return <AuthSplash />
  if (!published) return <Navigate to="/" replace />

  return (
    <TournamentDataProvider>
      <PredictionsProvider>
        <Outlet />
      </PredictionsProvider>
    </TournamentDataProvider>
  )
}
