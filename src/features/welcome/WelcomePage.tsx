import { Navigate } from 'react-router'
import { weeklyRoutes } from '../../app/weeklyRoutes'
import { AuthSplash } from '../auth/AuthSplash'
import { PublicFootballNameGate } from '../auth/PublicFootballNameGate'
import { OnboardingJourney } from '../onboarding/OnboardingJourney'
import { EuroWelcome } from '../euro/EuroWelcome'
import { useSite } from '../../app/site/SiteProvider'
import { useWelcomeHost } from './useWelcomeHost'

export function WelcomePage() {
  const site = useSite()
  const host = useWelcomeHost()

  if (host.kind === 'checking') return <AuthSplash />
  if (host.kind === 'seen') return <Navigate to={weeklyRoutes.hub} replace />

  return (
    <PublicFootballNameGate>
      {site.variant === 'euro' ? (
        <EuroWelcome displayName={host.displayName} onFinished={host.finish} />
      ) : (
        <OnboardingJourney displayName={host.displayName} onFinished={host.finish} />
      )}
    </PublicFootballNameGate>
  )
}