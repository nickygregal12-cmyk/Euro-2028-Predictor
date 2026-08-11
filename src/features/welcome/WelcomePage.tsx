import { useCallback, useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { clearPendingJoin, getPendingJoin } from '../leagues/pendingJoin'
import { useAuth } from '../auth/AuthProvider'
import { AuthSplash } from '../auth/AuthSplash'
import { OnboardingJourney } from '../onboarding/OnboardingJourney'
import { EuroWelcome } from '../euro/EuroWelcome'
import { useSite } from '../../app/site/SiteProvider'

/**
 * First sign-in.
 *
 * WHAT THIS PAGE WAS. One static orientation screen with a Continue button. It
 * marked the profile welcomed on mount and sent the player to the Hub, and the
 * four onboarding steps beside it were rendered nowhere — because contract 157
 * did not exist and there was nothing to save their answers into.
 *
 * WHAT IT IS. The route for the real journey. `OnboardingJourney` owns the
 * steps, the persistence and the resume; this page owns three things only:
 *
 *   1. WHETHER the journey should run at all;
 *   2. capturing the pending invite at a stable boundary;
 *   3. where the player lands when it finishes.
 *
 * THE GATE IS STILL `welcomed_at`, and deliberately so. `RequireWelcome` routes
 * on it, and having this page decide on contract 157's `onboarding_completed_at`
 * instead would create two gates that can disagree — a player would be sent here
 * by one and bounced away by the other, forever. The stamp is written on
 * arrival, exactly as before, so the journey is offered once; contract 157's
 * completion is what makes RESUMING it meaningful, and the journey reads that
 * itself.
 *
 * A PENDING INVITE SURVIVES SIGN-UP AND ONBOARDING BOTH. It is captured on
 * arrival, before anything can clear it, and consumed only when setup finishes.
 * Somebody who followed an invite link came to join something; onboarding is
 * the interruption, and it must hand them back to where they were going.
 *
 * WHICH JOURNEY RUNS IS THE DEPLOYMENT'S. `OnboardingJourney` is four DOMESTIC
 * steps — follow weekly competitions, favourite one of their clubs, join their
 * games, review — and running it on the Euro deployment walked a first-time
 * tournament visitor through the weekly platform's setup at the tournament's own
 * address. This page still owns the three things above, unchanged and identical
 * on both builds; only the journey between them differs. See
 * `src/features/euro/EuroWelcome.tsx`.
 */
export function WelcomePage() {
  const navigate = useNavigate()
  const site = useSite()
  const { displayName, welcomeStatus, markWelcomed } = useAuth()

  // Captured before our own markWelcomed() flips the status, and before the
  // journey can run: both must stay stable for the whole time this page is
  // mounted, or a re-render mid-setup would change where Finish goes.
  const neededOnArrival = useRef<boolean | null>(null)
  const pendingJoinOnArrival = useRef<string | null>(null)
  if (neededOnArrival.current === null && welcomeStatus !== 'loading') {
    neededOnArrival.current = welcomeStatus === 'needed'
    pendingJoinOnArrival.current = getPendingJoin()
  }

  // THE STAMP IS AN EFFECT, NOT PART OF THE RENDER. Reading the two refs above
  // during render is fine — it touches nothing outside this component — but
  // `markWelcomed` sets state in the auth provider, and doing that while a
  // different component is rendering is the one thing React asks you never to
  // do. This page shipped it inline and the version before it did not; putting
  // it back in an effect restores the rule rather than inventing one.
  useEffect(() => {
    if (neededOnArrival.current) markWelcomed()
  }, [markWelcomed, welcomeStatus])

  const finish = useCallback(() => {
    const pending = pendingJoinOnArrival.current
    if (pending) {
      // Consumed here rather than on the join screen's own arrival, so a player
      // who abandons setup halfway still has their invite waiting.
      clearPendingJoin()
      navigate(`/join/${pending}`, { replace: true })
      return
    }
    navigate(weeklyRoutes.hub, { replace: true })
  }, [navigate])

  if (neededOnArrival.current === null) return <AuthSplash />
  if (neededOnArrival.current === false) return <Navigate to={weeklyRoutes.hub} replace />

  return site.variant === 'euro' ? (
    <EuroWelcome displayName={displayName} onFinished={finish} />
  ) : (
    <OnboardingJourney displayName={displayName} onFinished={finish} />
  )
}
