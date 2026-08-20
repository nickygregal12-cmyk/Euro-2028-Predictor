import { Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { AuthSplash } from '../../features/auth/AuthSplash'
import { useInviteLanding } from '../../features/leagues/useInviteLanding'
import { VNextInviteScreen } from '../../vnext/integration/invite/VNextInviteScreen'
import { weeklyRoutes } from '../weeklyRoutes'
import { useViewerFormatting } from './seam'
import { VNextAppRoot } from './VNextAppRoot'

/**
 * THE INVITE DEEP LINK, `/join/:code`, IN THE PRODUCT IT LEADS INTO.
 *
 * ============================ THE SEAM THIS CLOSES ======================
 *
 * Stage 13 built `src/vnext/invite/` and its integration adapter — stories,
 * tests, a `/dev` harness — and production went on serving the legacy card. So
 * the most common way a NEW player meets this product for the first time, a
 * link from a friend, was the one surface still wearing the old design.
 *
 * ============================ WHAT IT DOES NOT DO ======================
 *
 * IT DOES NOT TOUCH INVITE SECURITY. `useInviteCode` resolves and accepts, and
 * dispatches on the server's own `joinWith` rather than on the code's shape or
 * anything the browser inferred; `VNextInviteScreen` calls it and this file
 * calls neither. There is no second copy of the join here, which is the whole
 * reason that hook exists.
 *
 * IT DOES NOT REDECIDE THE HAND-OFF. Stashing the code, routing a signed-out
 * visitor through sign-up so the auth gate can resume the exact deep link,
 * consuming the pending redirect on arrival, and where a joined container OPENS
 * on this build are all `useInviteLanding`'s — the same hook the legacy page
 * calls. A pending invitation surviving authentication AND onboarding is an
 * accepted requirement, and a second copy of it is how that requirement breaks
 * without anybody noticing.
 *
 * ============================ AND IT BRINGS ITS OWN FRAME ===============
 *
 * `/join/:code` is registered outside `RequireAuth` and outside `AppShell`, so
 * there is no legacy chrome to surrender and no frame-ownership row is owed —
 * `frameOwnership.ts` names this address in `OUTSIDE_THE_LEGACY_FRAME` for
 * exactly that reason. `VNextInviteScreen` builds its own shell, with no
 * competition in it, because accepting the invitation is how a player gets one.
 */
export function VNextJoinDestination() {
  useViewerFormatting()
  const { code } = useParams<{ code: string }>()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const landing = useInviteLanding(code)

  if (landing.kind === 'checking') return <AuthSplash />
  if (landing.kind === 'sign-up') return <Navigate to="/auth/signup" replace />

  const landOn = landing.landOn

  return (
    <VNextAppRoot>
      <VNextInviteScreen
        userId={userId}
        authLoading={loading}
        code={code}
        // THE ATTENTION LAYER IS DELIBERATELY ABSENT. `shellElsewhere` costs a
        // play-context read plus up to three game reads per competition, and
        // this address is reached by people who frequently have none. The
        // screen's own prop docs call `undefined` "the one-competition shape",
        // which is the honest shape for a page-scoped host.
        onJoined={landOn}
        onGoHome={() => navigate(weeklyRoutes.leagues, { replace: true })}
        // No `onOpenGame`: contract 159 stopped the resolver returning a
        // container id, so there is nothing to open BY. A player who is already
        // in is sent to their private play, which is where it is.
      />
    </VNextAppRoot>
  )
}
