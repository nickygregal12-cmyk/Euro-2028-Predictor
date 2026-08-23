import { Navigate } from 'react-router'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { AuthSplash } from '../auth/AuthSplash'
import { OnboardingJourney } from '../onboarding/OnboardingJourney'
import { EuroWelcome } from '../euro/EuroWelcome'
import { useSite } from '../../app/site/SiteProvider'
import { useWelcomeHost } from './useWelcomeHost'

/**
 * First sign-in.
 *
 * WHAT THIS PAGE WAS. One static orientation screen with a Continue button. It
 * marked the profile welcomed on mount and sent the player to the Hub, and the
 * four onboarding steps beside it were rendered nowhere — because contract 157
 * did not exist and there was nothing to save their answers into.
 *
 * WHAT IT IS. The LEGACY presentation of the real journey, and one of two.
 * `OnboardingJourney` owns the steps; `useWelcomeHost` owns the three things
 * this address owns whichever presentation runs — the arrival gate, the pending
 * invite, and where Finish goes — because the vNext presentation at
 * `src/app/vnext/VNextWelcomeDestination.tsx` owns exactly the same three and a
 * second copy of them is how a player gets bounced between two answers or loses
 * the invite they followed to get here.
 *
 * WHICH JOURNEY RUNS IS THE DEPLOYMENT'S. `OnboardingJourney` is four DOMESTIC
 * steps — follow weekly competitions, favourite one of their clubs, join their
 * games, review — and running it on the Euro deployment walked a first-time
 * tournament visitor through the weekly platform's setup at the tournament's own
 * address. See `src/features/euro/EuroWelcome.tsx`. **The Euro branch is this
 * page's alone**: the vNext cutover never serves it, so a tournament visitor
 * reaches `EuroWelcome` on either side of the flag.
 */
export function WelcomePage() {
  const site = useSite()
  const host = useWelcomeHost()

  if (host.kind === 'checking') return <AuthSplash />
  if (host.kind === 'seen') return <Navigate to={weeklyRoutes.hub} replace />

  return site.variant === 'euro' ? (
    <EuroWelcome displayName={host.displayName} onFinished={host.finish} />
  ) : (
    <OnboardingJourney displayName={host.displayName} onFinished={host.finish} />
  )
}
