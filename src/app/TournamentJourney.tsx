import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { AuthSplash } from '../features/auth/AuthSplash'
import {
  fetchEuroPublicationState,
  type EuroPublicationSnapshot,
} from '../services/supabase/euroPublication'
import { TournamentDataProvider } from './providers/TournamentDataProvider'
import { LiveResultsProvider } from './providers/LiveResultsProvider'
import { PredictionsProvider } from './providers/PredictionsProvider'
import { useSite } from './site/SiteProvider'

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
 * `EURO-001` ADDS A SECOND GATE, AND IT IS THE DEPLOYMENT'S. ADR 0026 puts Euro
 * 2028 on its own domain, so a build that is not the tournament's site must not
 * serve the tournament's PLAYER routes at all — not merely omit them from a
 * catalogue, because a catalogue omission is not a control and a guessable URL
 * still resolves. `servesEuroTournament` decides, and this refuses before it
 * reads anything.
 *
 * BOTH DEPLOYMENTS SET IT TRUE TODAY, and that is recorded on the field rather
 * than hidden here: the weekly app is still where the tournament is
 * administered and where its preserved journeys live, so withdrawing them now
 * would delete the `euro-2028-baseline` return evidence instead of moving it.
 * The refusal is built and proven; turning it on for the Hub is an owner
 * decision that also needs the browser suite pointed at the Euro build.
 *
 * THE TWO GATES ARE INDEPENDENT AND NEITHER REPLACES THE OTHER. The deployment
 * gate answers "is this the tournament's site"; the publication gate answers
 * "has its owner published it". A build that serves the tournament still waits
 * for the server, and a build that does not never asks — which also means it
 * pays no round trip for a question whose answer cannot change what it renders.
 *
 * THE AUTHORISED `/admin/results` PREPARATION PATH IS EXEMPT FROM BOTH GATES,
 * and the second exemption is a correction. A hidden tournament still has to be
 * prepared before its owner can publish it; hiding the tournament must not
 * remove the results workspace needed to reach a publishable state. This
 * session first reasoned that "preparing Euro 2028 is done on the Euro site"
 * and withheld it — there is no separate administration deployment, so that
 * removed the only Results Centre there is, and the browser suite said so. The
 * route remains protected independently by `RequireAdmin` in `App.tsx`.
 */
export function TournamentJourney({
  readPublicationState = fetchEuroPublicationState,
}: TournamentJourneyProps) {
  const site = useSite()
  const location = useLocation()
  const isAdminPreparation = location.pathname === '/admin/results'
  const [published, setPublished] = useState<boolean | null>(isAdminPreparation ? true : null)

  useEffect(() => {
    if (isAdminPreparation) {
      setPublished(true)
      return
    }
    if (!site.servesEuroTournament) return

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
  }, [isAdminPreparation, readPublicationState, site.servesEuroTournament])

  // The deployment gate, before the publication gate and before any read —
  // except for the administration path, which both gates exempt.
  if (!site.servesEuroTournament && !isAdminPreparation) {
    return <Navigate to={site.routes.signedInHome} replace />
  }
  if (published === null) return <AuthSplash />
  if (!published) return <Navigate to="/" replace />

  return (
    <TournamentDataProvider>
      <PredictionsProvider>
        {/* Inside the auth gate, so the channel only ever opens for a session
            that is entitled to read `matches`. */}
        <LiveResultsProvider>
          <Outlet />
        </LiveResultsProvider>
      </PredictionsProvider>
    </TournamentDataProvider>
  )
}
