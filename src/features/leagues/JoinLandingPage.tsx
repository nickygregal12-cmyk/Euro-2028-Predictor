import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Alert, Button, Skeleton } from '../../design-system'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { useSite } from '../../app/site/SiteProvider'
import { useAuth } from '../auth/AuthProvider'
import { AuthSplash } from '../auth/AuthSplash'
import { InvitePreviewCard } from './InvitePreviewCard'
import { joinedInviteHref } from './joinDestination'
import { useInviteCode, type InviteJoinResult } from './useInviteCode'
import { clearPendingJoin, setPendingJoin } from './pendingJoin'
import j from './join.module.css'

/**
 * The invite deep link, `/join/:code`.
 *
 * IT RESOLVES ANY CODE NOW, not only a league's (`MIG-UI-07`, contract 155). A
 * private Last Man Standing or Championship link lands here and works; before
 * this it was answered "this invite code doesn't match a league", which was
 * literally true and told the invitee nothing they could act on.
 *
 * IT LIVES OUTSIDE THE AUTH GATE, deliberately, so it can handle the signed-out
 * case itself: stash the code, send the visitor to sign-up, and the auth gate
 * returns them here once they are in. Onboarding then hands the code back at
 * the end rather than swallowing it — a first-time visitor who arrived from an
 * invite still gets where they were going.
 *
 * WHERE IT LANDS IS A RULE ABOUT THE BUILD, and it is not this file's. A joined
 * league used to open at `/league/:id` unconditionally; that address is the
 * TOURNAMENT's league table — its read refuses a season league by name and its
 * page needs both tournament providers — so on the Hub it is a destination that
 * cannot answer. `joinDestination.ts` owns the choice and states the
 * measurement.
 *
 * WHAT IT NO LONGER DOES. It used to create an Original Predictor entry before
 * joining, a compatibility step for the preserved Euro invite that predates
 * game ids. `resolve_invite_code` states the prerequisite instead —
 * `requiresGameEntry` — so the invitee is told which game to join rather than
 * being silently entered into one. Creating a tournament entry as a side effect
 * of opening a link is exactly the kind of invisible membership the platform's
 * separation rules exist to prevent.
 */
export function JoinLandingPage() {
  const { code } = useParams<{ code: string }>()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const site = useSite()
  const { state, joining, resolve, accept } = useInviteCode()
  const [storedPendingCode, setStoredPendingCode] = useState<string | null>(null)

  const authed = Boolean(userId)

  useEffect(() => {
    if (loading || authed || !code) return
    setPendingJoin(code)
    setStoredPendingCode(code)
  }, [authed, code, loading])

  useEffect(() => {
    if (!authed || !code) return
    clearPendingJoin()
    void resolve(code)
  }, [authed, code, resolve])

  if (loading) return <AuthSplash />

  if (!authed) {
    if (code && storedPendingCode !== code) return <AuthSplash />
    return <Navigate to="/auth/signup" replace />
  }

  function landOn(joined: InviteJoinResult) {
    navigate(joinedInviteHref(joined, site.servesEuroTournament), { replace: true })
  }

  return (
    <div className={j.page}>
      <div className={j.card}>
        <p className={j.eyebrow}>{site.brand.productName}</p>

        {(state.status === 'idle' || state.status === 'looking') && <Skeleton lines={4} />}

        {state.status === 'notfound' && (
          <>
            <Alert variant="error" title="Invite not found">
              This code doesn’t match anything. Ask your friend for a fresh link.
            </Alert>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate(weeklyRoutes.leagues, { replace: true })}
            >
              Go to private play
            </Button>
          </>
        )}

        {state.status === 'error' && (
          <>
            <Alert variant="error" title="Couldn’t use that invite">
              {state.message}
            </Alert>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate(weeklyRoutes.leagues, { replace: true })}
            >
              Go to private play
            </Button>
          </>
        )}

        {state.status === 'ready' && (
          <InvitePreviewCard
            invite={state.invite}
            joining={joining}
            onJoin={() => {
              void (async () => {
                const joined = await accept(code ?? '')
                if (joined) landOn(joined)
              })()
            }}
            onDecline={() => navigate(weeklyRoutes.leagues, { replace: true })}
            declineLabel={state.invite.alreadyIn ? 'Go to your private play' : undefined}
          />
        )}
      </div>
    </div>
  )
}
