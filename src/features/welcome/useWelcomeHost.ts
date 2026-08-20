import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { useAuth } from '../auth/AuthProvider'
import { clearPendingJoin, getPendingJoin } from '../leagues/pendingJoin'

/**
 * THE THREE THINGS `/welcome` OWNS, WHICHEVER PRESENTATION RUNS INSIDE IT.
 *
 * ============================ WHY IT IS A HOOK ==========================
 *
 * `WelcomePage`'s own docblock names them, and they are the same three whether
 * the steps are drawn by `OnboardingJourney` or by the vNext onboarding screen:
 *
 *   1. WHETHER the journey should run at all;
 *   2. capturing the pending invite at a stable boundary;
 *   3. where the player lands when it finishes.
 *
 * Cutting the route over to a second presentation would otherwise mean a second
 * copy of all three — and the two copies that matter most are the ones a copy
 * breaks silently. A duplicated arrival gate can bounce a player between two
 * answers forever; a duplicated invite capture can swallow the link somebody
 * followed to get here. So both presentations call this, and the rules below
 * are unchanged from the page that first held them.
 *
 * ============================ THE GATE IS STILL `welcomed_at` ===========
 *
 * `RequireWelcome` routes on it, and deciding here on contract 157's
 * `onboarding_completed_at` instead would create two gates that can disagree —
 * a player sent here by one and bounced away by the other, forever. The stamp
 * is written on arrival, exactly as before, so the journey is offered once;
 * contract 157's completion is what makes RESUMING it meaningful, and the
 * journey reads that itself.
 *
 * ============================ A PENDING INVITE SURVIVES SETUP ===========
 *
 * Captured on arrival, before anything can clear it, and consumed only when
 * setup finishes. Somebody who followed an invite link came to join something;
 * onboarding is the interruption, and it must hand them back to where they were
 * going. A player who abandons setup halfway still has their invite waiting.
 */

export type WelcomeHost =
  /** The `welcomed_at` read has not answered. Draw nothing that can flash. */
  | { readonly kind: 'checking' }
  /** Already welcomed. This address is not theirs; the caller redirects. */
  | { readonly kind: 'seen' }
  | {
      readonly kind: 'run'
      readonly displayName: string | null
      /** Setup is over — go wherever the invite, or its absence, says. */
      readonly finish: () => void
    }

export function useWelcomeHost(): WelcomeHost {
  const navigate = useNavigate()
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
  // during render is fine — it touches nothing outside this hook — but
  // `markWelcomed` sets state in the auth provider, and doing that while a
  // different component is rendering is the one thing React asks you never to
  // do.
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

  if (neededOnArrival.current === null) return { kind: 'checking' }
  if (neededOnArrival.current === false) return { kind: 'seen' }
  return { kind: 'run', displayName, finish }
}
