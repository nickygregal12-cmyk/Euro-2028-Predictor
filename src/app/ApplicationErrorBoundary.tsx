import { Component, type ErrorInfo, type ReactNode } from 'react'

import {
  clearFailureCount,
  clearLocalSession,
  correlationReference,
  recordFailure,
} from './fatalRecovery'
import { currentSiteConfiguration } from './site/currentSite'
import { reportFatalRenderError } from '../services/observability/fatalRenderError'

interface ApplicationErrorBoundaryProps {
  readonly children: ReactNode
}

interface ApplicationErrorBoundaryState {
  readonly failed: boolean
  /** Set once the fault has proved deterministic — see `fatalRecovery`. */
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
 * The last line of defence.
 *
 * Reload remains the FIRST remedy and is unchanged: most faults are transient
 * and a reload is the cheapest thing that clears them. What is new is the
 * second: a fault that survives a reload is deterministic, and offering the
 * same remedy again is the loop `UX-004` records. After the second consecutive
 * failure this offers a local sign-out instead, which discards the one piece of
 * browser-persisted state that can carry a fault across reloads.
 *
 * Everything destructive lives in `fatalRecovery.ts` and is pure, because the
 * one thing worse than an application that cannot recover is a recovery path
 * that removes something the user wanted. Nothing here touches the network:
 * this code runs precisely when the application has stopped working, so any
 * remedy that needs the application to work is not a remedy.
 */
export class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  public state: ApplicationErrorBoundaryState = INITIAL

  public static getDerivedStateFromError(): Partial<ApplicationErrorBoundaryState> {
    return { failed: true }
  }

  public componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Generate the support reference once, before storage. A browser that blocks
    // sessionStorage still deserves a reference, and — critically — the exact
    // reference painted in the fallback is the one attached to observability.
    const reference = correlationReference(new Date(), Math.random())
    reportFatalRenderError(error, reference, info.componentStack)

    // Storage can throw or be absent — a private-mode browser, a blocked
    // origin, a disabled cookie policy. A recovery path that itself throws
    // leaves the user with nothing at all, so every access here is guarded and
    // the fallback is the previous behaviour: reload only.
    try {
      const { offerRecovery } = recordFailure(window.sessionStorage)
      this.setState({ offerRecovery, reference })
    } catch {
      this.setState({ offerRecovery: false, reference })
    }
  }

  private readonly recover = (): void => {
    // Each store is handled separately. Failure to read one must not prevent
    // the other narrow cleanup, and neither operation may clear unrelated
    // same-origin state.
    try {
      clearLocalSession(window.localStorage)
    } catch {
      // Continue to the crash-counter cleanup below.
    }
    try {
      clearFailureCount(window.sessionStorage)
    } catch {
      // Nothing to do but continue to the restart below: if storage cannot be
      // read it cannot be relied on as part of recovery either.
    }
    this.setState({ recovered: true })
    // Origin root rather than history: the failing route is a candidate cause,
    // so returning to it would be the same loop by another name.
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
