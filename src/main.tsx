import './instrument'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/flags.css'
import './styles/tokens.css'
import './index.css'
import App from './App.tsx'
import { ApplicationErrorBoundary } from './app/ApplicationErrorBoundary'
import {
  installGlobalErrorCapture,
  reportClientError,
} from './services/observability/clientObservability'
import { initDevAuth } from './services/supabase/devAutoLogin'
import { initProductAnalytics } from './services/analytics/productAnalytics'

installGlobalErrorCapture()

// Fire-and-forget, and deliberately NOT awaited before the first render.
// With no key configured this returns immediately and never requests the
// PostHog chunk; with one, the events recorded during startup queue behind
// it. Either way a player waits for nothing -- analytics that can delay the
// application is worse than no analytics.
void initProductAnalytics()

// Dev auto-login runs before the first render (docs/auth-plan.md §1). In a
// production build this is a no-op — UNLESS the autologin flag is still set, in
// which case initDevAuth throws and we deliberately refuse to render the app
// (fail-closed). In dev it silently signs in as the seeded dev user.
initDevAuth()
  .then(() => {
    const rootElement = document.getElementById('root')!
    const reportReactError = (
      error: unknown,
      errorInfo: { componentStack?: string | null | undefined },
    ) => {
      reportClientError(
        error,
        'react',
        window.location.pathname,
        errorInfo.componentStack ?? null,
      )
    }

    createRoot(rootElement, {
      onCaughtError: reportReactError,
      onUncaughtError: reportReactError,
      onRecoverableError: reportReactError,
    }).render(
      <StrictMode>
        <ApplicationErrorBoundary>
          <App />
        </ApplicationErrorBoundary>
      </StrictMode>,
    )
  })
  .catch((error) => {
    reportClientError(error, 'startup')
    console.error(error)
    const root = document.getElementById('root')
    if (root) {
      root.textContent =
        'Application failed to start due to an invalid configuration.'
    }
  })
