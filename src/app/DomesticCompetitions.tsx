import { Navigate, Outlet } from 'react-router'
import { useSite } from './site/SiteProvider'

/**
 * The boundary the domestic weekly competition tree lives behind.
 *
 * WHAT IT REFUSES. The published catalogue at `/competitions` and everything
 * under `/competitions/:competitionSlug/:seasonSlug` — a season's overview, its
 * matches, its Match Centre, its games, its private leagues, its player profiles.
 * That is the Prediction Hub's entire product, and the Euro deployment was
 * serving all of it: a visitor to the tournament's domain could reach the
 * Scottish Premiership's Match Predictor at a URL on the tournament's domain,
 * under navigation reading "Tournament", and nothing anywhere told them they had
 * left the product they came for.
 *
 * IT IS THE SAME CONTROL AS `TournamentJourney`'S DEPLOYMENT GATE, POINTING THE
 * OTHER WAY, and for the same reason: a catalogue omission is not a control,
 * because a guessable URL still resolves. `EURO-001` records that the weekly
 * platform still serves the tournament's player routes; this is that boundary's
 * other half, and it is the half that can be closed today — withdrawing the
 * weekly tree from the Euro build strands no browser evidence, because no
 * journey enters it from there.
 *
 * IT IS ADDRESSING, NOT AUTHORISATION. Nothing here decides what a player may
 * see; the server still owns every lock, membership and reveal. It decides which
 * deployment answers an address, which is the one thing a build-time variant is
 * allowed to decide.
 *
 * IT REDIRECTS RATHER THAN REFUSING, because on the Euro build these paths are
 * not a locked door — they are a different product's addresses, and this build's
 * home is where somebody who typed one belongs. The Hub is reachable from there
 * by the sibling link, which names where it goes.
 */
export function DomesticCompetitions() {
  const site = useSite()
  if (!site.servesDomesticCompetitions) {
    return <Navigate to={site.routes.signedInHome} replace />
  }
  return <Outlet />
}
