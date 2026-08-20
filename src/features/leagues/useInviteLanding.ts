import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSite } from '../../app/site/SiteProvider'
import { useAuth } from '../auth/AuthProvider'
import { joinedInviteHref } from './joinDestination'
import { clearPendingJoin, setPendingJoin } from './pendingJoin'
import type { InviteJoinResult } from './useInviteCode'

/**
 * WHAT `/join/:code` OWNS THAT IS NOT THE INVITE ITSELF.
 *
 * ============================ WHY IT IS A HOOK ==========================
 *
 * `JoinLandingPage`'s docblock names them, and they are the same three whether
 * the invite is drawn by the legacy card or by the vNext invite surface:
 *
 *   1. the SIGNED-OUT hand-off — stash the code, send the visitor to sign-up,
 *      and let the auth gate return them to the exact deep link;
 *   2. consuming the pending redirect once they arrive signed in;
 *   3. where a joined container OPENS, which is a rule about the build.
 *
 * None of the three is presentation, and a second copy of the first one loses
 * the invite somebody followed to get here — which is an accepted requirement,
 * not a nicety. So both presentations call this, and the rules below are
 * unchanged from the page that first held them.
 *
 * ============================ THE ORDER IS LOAD-BEARING =================
 *
 * Storage is an external side effect, so the code is persisted only after React
 * has committed the signed-out landing state, and only THEN is the sign-up
 * redirect allowed. Tracking the exact code prevents a route-param change from
 * redirecting before the new value has replaced the old pending invite.
 */

export type InviteLanding =
  /** The session has not resolved. Draw the splash; decide nothing. */
  | { readonly kind: 'checking' }
  /** Signed out, and the code is safely stored. Send them to sign up. */
  | { readonly kind: 'sign-up' }
  | {
      readonly kind: 'ready'
      /** Where a joined container opens on THIS build. Replaces history. */
      readonly landOn: (joined: InviteJoinResult) => void
    }

export function useInviteLanding(code: string | undefined): InviteLanding {
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const site = useSite()
  const [storedPendingCode, setStoredPendingCode] = useState<string | null>(null)

  const authed = Boolean(userId)

  useEffect(() => {
    if (loading || authed || !code) return
    setPendingJoin(code)
    setStoredPendingCode(code)
  }, [authed, code, loading])

  useEffect(() => {
    if (!authed || !code) return
    // We have arrived signed in — the pending redirect is consumed.
    clearPendingJoin()
  }, [authed, code])

  const landOn = useCallback(
    (joined: InviteJoinResult) => {
      // Where a joined container opens is a rule about this BUILD, not about a
      // component, so it lives in `joinDestination.ts` and is asserted there. A
      // private competition has no page of its own on either build, and a
      // league has one only where the tournament is served. Sending a player to
      // the private play list is honest; sending them to a page whose server
      // read refuses their league is not.
      navigate(joinedInviteHref(joined, site.servesEuroTournament), { replace: true })
    },
    [navigate, site.servesEuroTournament],
  )

  if (loading) return { kind: 'checking' }
  if (!authed) {
    // Wait until the code has been committed to storage before routing through
    // sign-up, so the auth gate can resume the exact deep link.
    if (code && storedPendingCode !== code) return { kind: 'checking' }
    return { kind: 'sign-up' }
  }
  return { kind: 'ready', landOn }
}
