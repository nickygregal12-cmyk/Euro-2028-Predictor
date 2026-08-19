import { Component, type ReactNode } from 'react'

import {
  clearFailureCount,
  clearLocalSession,
  correlationReference,
  recordFailure,
} from './fatalRecovery'
import { currentSiteConfiguration } from './site/currentSite'

interface ApplicationErrorBoundaryProps {
  readonly children: ReactNode
}

interface ApplicationErrorBoundaryState {
  readonly failed: boolean
  readonly offerRecovery: boolean
  readonly reference: string | null
  readonly recovered: boolean
}

const INITIAL: ApplicationErrorBoundaryState = {
  failed: false,
  offerRecovery: false,
  reference: null,
  recovered: false,
}

/**
 * The last line of defence. The product label is resolved from the same site
 * configuration as the rest of the application, because this boundary sits
 * outside `SiteProvider` and otherwise became a hidden hard-coded Hub brand.
 */
export class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  public state: ApplicationErrorBoundaryState = INITIAL

  public static getDerivedStateFromError(): Partial<ApplicationErrorBoundaryState> {
    return { failed: true }
  }

  public componentDidCatch(): void {
    try {
      const { offerRecovery } = recordFailure(window.sessionStorage)
      this.setState({
        offerRecovery,
        reference: correlationReference(new Date(), Math.random()),
      })
    } catch {
      this.setState({ offerRecovery: false, reference: null })
    }
  }

  private readonly recover = (): void => {
    try {
      clearLocalSession(window.localStorage)
    } catch {
      // Continue to the crash-counter cleanup below.
    }
    try {
      clearFailureCount(window.sessionStorage)
    } catch {
      // Continue to restart even when storage itself is unavailable.
    }
    this.setState({ recovered: true })
    window.location.assign('/')
  }

  public render() {
    if (!this.state.failed) return this.props.children

    const { offerRecovery, reference, recovered } = this.state
    const productName = currentSiteConfiguration().brand.productName

    return (
      <main
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: 'var(--color-bg, #07111f)',
          color: 'var(--color-text, #f8fafc)',
        }}
      >
        <section
          aria-labelledby="application-error-title"
          style={{ width: 'min(100%, 32rem)', textAlign: 'center' }}
        >
          <p style={{ margin: 0, opacity: 0.72 }}>{productName}</p>
          <h1 id="application-error-title">Something went wrong</h1>

          {offerRecovery ? (
            <>
              <p>
                This has now failed twice, so reloading is unlikely to help. You
                can sign out on this device and start again — your account,
                predictions, leagues and results are stored on the server and are
                not affected.
              </p>
              <button
                type="button"
                onClick={this.recover}
                disabled={recovered}
                style={{
                  minHeight: '2.75rem',
                  padding: '0.75rem 1rem',
                  border: 0,
                  borderRadius: '0.75rem',
                  font: 'inherit',
                  fontWeight: 700,
                  cursor: recovered ? 'progress' : 'pointer',
                }}
              >
                {recovered ? 'Signing out…' : 'Sign out on this device and restart'}
              </button>
            </>
          ) : (
            <>
              <p>
                Your account and predictions have not been changed. Reload the app
                to try again.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  minHeight: '2.75rem',
                  padding: '0.75rem 1rem',
                  border: 0,
                  borderRadius: '0.75rem',
                  font: 'inherit',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reload app
              </button>
            </>
          )}

          {reference !== null && (
            <p style={{ marginTop: '1.5rem', opacity: 0.72, fontSize: '0.875rem' }}>
              If you contact support, quote{' '}
              <code style={{ fontWeight: 700 }}>{reference}</code>.
            </p>
          )}
        </section>
      </main>
    )
  }
}
