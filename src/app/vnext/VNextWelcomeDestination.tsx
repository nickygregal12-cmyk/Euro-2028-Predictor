import { Navigate } from 'react-router'
import { useCallback, useState } from 'react'
import { useAuth } from '../../features/auth/AuthProvider'
import { PublicFootballNameGate } from '../../features/auth/PublicFootballNameGate'
import { EuroWelcome } from '../../features/euro/EuroWelcome'
import { AuthSplash } from '../../features/auth/AuthSplash'
import { commitOnboarding } from '../../features/onboarding/commitOnboarding'
import { useWelcomeHost } from '../../features/welcome/useWelcomeHost'
import { userFacingError } from '../../shared/errors/userFacingError'
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
import { VNextAppRoot } from './VNextAppRoot'
import { VNextSurfaceBoundary } from './VNextSurfaceBoundary'

/**
 * FIRST SIGN-IN, WITH ITS OWN BOUNDARY BECAUSE IT IS OUTSIDE THE SEAM.
 *
 * `VNextSeamLayout` holds one `VNextSurfaceBoundary` above the twelve
 * competition destinations. `/welcome` is registered under `RequireAuth` and
 * ABOVE `RequireWelcome` — it is the screen that makes `RequireWelcome` pass —
 * so it can never be inside that layout, and without one of its own a throw here
 * would give a brand-new account the fatal fallback as its first impression of
 * the product.
 *
 * The boundary is the OUTER component and the work is the inner one,
 * deliberately: `useWelcomeHost` runs before any element is returned, so a
 * boundary rendered from inside that function could not catch the hook that
 * produced the failure.
 */
export function VNextWelcomeDestination() {
  return (
    <VNextSurfaceBoundary ownsFrame>
      <VNextWelcomeDestinationContent />
    </VNextSurfaceBoundary>
  )
}

function VNextWelcomeDestinationContent() {
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
          const outcome = await commitOnboarding({ draft: finish.draft, player: finish.player })
          if (outcome.kind === 'partial') {
            setCommit({ kind: 'partial', refused: outcome.refused })
            return
          }
          setCommit({ kind: 'idle' })
          finished?.()
        } catch (error) {
          setCommit({
            kind: 'failed',
            message: userFacingError(error, 'We could not finish your setup. Please try again.'),
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
        const { setOnboardingProgress } = await import('../../services/supabase/playerPreferences')
        await setOnboardingProgress(step)
      } catch {
        // Progress is best-effort; a slow/failed stamp must not trap onboarding.
      }
    })()
  }, [])

  if (host.kind === 'checking') return <AuthSplash />
  if (host.kind === 'seen') return <Navigate to={weeklyRoutes.hub} replace />

  if (site.variant === 'euro') {
    return (
      <PublicFootballNameGate>
        <EuroWelcome displayName={host.displayName} onFinished={host.finish} />
      </PublicFootballNameGate>
    )
  }

  return (
    <VNextAppRoot>
      <PublicFootballNameGate>
        <VNextShellProvider
          model={buildShellModel({
            competition: null,
            playerName: host.displayName,
            outstandingGames: null,
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
      </PublicFootballNameGate>
    </VNextAppRoot>
  )
}