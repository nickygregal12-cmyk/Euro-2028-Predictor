import { Navigate } from 'react-router'
import { useCallback, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { EuroWelcome } from '../../features/euro/EuroWelcome'
import { AuthSplash } from '../../features/auth/AuthSplash'
import { commitOnboarding } from '../../features/onboarding/commitOnboarding'
import { useWelcomeHost } from '../../features/welcome/useWelcomeHost'
import { userFacingError } from '../../shared/errors/userFacingError'
import { VNextRoot } from '../../vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../vnext/app/VNextShellProvider'
import { buildShellModel } from '../../vnext/integration/shell/buildShellModel'
import {
  VNextOnboardingScreen,
  type OnboardingFinish,
} from '../../vnext/integration/onboarding/VNextOnboardingScreen'
import type { OnboardingCommit } from '../../vnext/models/onboarding'
import { useSite } from '../site/SiteProvider'
import { weeklyRoutes } from '../weeklyRoutes'
import { useViewerFormatting } from './seam'

/**
 * FIRST SIGN-IN, IN THE PRODUCT THE PLAYER IS ABOUT TO BE IN.
 *
 * ============================ THE SEAM THIS CLOSES ======================
 *
 * `src/vnext/onboarding/` and `src/vnext/integration/onboarding/` have been a
 * complete onboarding implementation since Stage 13 — stories, tests and a
 * `/dev` harness — and production went on serving the legacy presentation. So a
 * brand-new account signed up, met the old design at `/welcome`, and then
 * landed in the Competition Deck: the first two minutes of the product were the
 * one journey where the migration was most visible and least finished.
 *
 * ============================ WHAT IT DOES NOT DO ======================
 *
 * IT DOES NOT REWRITE THE COMMIT. Follows, game entries, completion, partial
 * failure and resume all belong to `features/onboarding/commitOnboarding.ts`,
 * which is the only copy of that order and is the same one the legacy journey
 * calls. `VNextOnboardingScreen` was deliberately written to EMIT AN INTENT and
 * let its host commit — see its header — and this is that host. It holds no
 * rule about what finishing means; it calls the authority and reports what came
 * back.
 *
 * IT DOES NOT OWN THE GATE OR THE INVITE EITHER. `useWelcomeHost` does, for
 * both presentations, because a second copy of the arrival gate can bounce a
 * player between two answers forever and a second copy of the invite capture
 * can swallow the link they followed to get here.
 *
 * IT IS NOT THE EURO JOURNEY. `OnboardingJourney`'s four steps are DOMESTIC —
 * follow weekly competitions, favourite one of their clubs, join their games —
 * and the tournament has its own first-run screen. The cutover flags reach both
 * deployments from one `netlify.toml`, so the variant is asked HERE, exactly as
 * `WelcomePage` asks it, and a tournament visitor gets `EuroWelcome` on either
 * side of the flag.
 *
 * ============================ THE PROGRESS STAMP IS FORWARD-ONLY =======
 *
 * `onStep` reports the direction, and only a forward move is stamped. A host
 * that stamped every report would walk a player's stored progress BACKWARDS the
 * moment they pressed Back and resume them there on their next sign-in. The
 * write is not awaited, for the reason the legacy journey states: a slow
 * network must not make setup feel broken, and the cost of losing one stamp is
 * a single repeated step.
 */
export function VNextWelcomeDestination() {
  useViewerFormatting()
  const site = useSite()
  const host = useWelcomeHost()
  const { userId, loading } = useAuth()
  const [commit, setCommit] = useState<OnboardingCommit>({ kind: 'idle' })

  const finished = host.kind === 'run' ? host.finish : null

  const onFinish = useCallback(
    (finish: OnboardingFinish) => {
      setCommit({ kind: 'working' })
      void (async () => {
        try {
          const outcome = await commitOnboarding({
            draft: finish.draft,
            player: finish.player,
          })
          if (outcome.kind === 'partial') {
            // NAMED, NOT SUMMARISED, and the player stays on the screen with
            // everything that did save already saved. The model draws the list
            // and offers the way out; nothing here decides that it is fatal,
            // because it is not.
            setCommit({ kind: 'partial', refused: outcome.refused })
            return
          }
          setCommit({ kind: 'idle' })
          finished?.()
        } catch (error) {
          setCommit({
            kind: 'failed',
            message: userFacingError(
              error,
              'We could not finish your setup. Please try again.',
            ),
          })
        }
      })()
    },
    [finished],
  )

  const onStep = useCallback((step: string, direction: 'forward' | 'back') => {
    if (direction !== 'forward') return
    void (async () => {
      try {
        const { setOnboardingProgress } = await import(
          '../../services/supabase/playerPreferences'
        )
        await setOnboardingProgress(step)
      } catch {
        // Deliberately silent. The player is not the person who can fix this,
        // and interrupting their setup to say so would be noise.
      }
    })()
  }, [])

  if (host.kind === 'checking') return <AuthSplash />
  if (host.kind === 'seen') return <Navigate to={weeklyRoutes.hub} replace />

  if (site.variant === 'euro') {
    return <EuroWelcome displayName={host.displayName} onFinished={host.finish} />
  }

  return (
    <VNextRoot>
      {/* A SHELL WITH NO COMPETITION IN IT, which is the truth of this moment:
          choosing competitions is what the page is for. `canNavigateAway` is
          false because there is nowhere to navigate to yet — the player has no
          competition, and offering the deck's destinations before setup would
          be chrome for a product they have not entered. */}
      <VNextShellProvider
        model={buildShellModel({
          competition: null,
          playerName: host.displayName,
          outstandingPredictions: null,
          canNavigateAway: false,
          elsewhere: null,
        })}
      >
        <VNextOnboardingScreen
          userId={userId}
          authLoading={loading}
          displayName={host.displayName}
          commit={commit}
          onFinish={onFinish}
          onStep={onStep}
          onLeave={host.finish}
        />
      </VNextShellProvider>
    </VNextRoot>
  )
}
