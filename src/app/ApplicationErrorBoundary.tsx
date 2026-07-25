import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../services/observability/clientObservability'

interface ApplicationErrorBoundaryProps {
  readonly children: ReactNode
}

interface ApplicationErrorBoundaryState {
  readonly failed: boolean
}

export class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  public state: ApplicationErrorBoundaryState = { failed: false }

  public static getDerivedStateFromError(): ApplicationErrorBoundaryState {
    return { failed: true }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(error, 'react', window.location.pathname, info.componentStack)
  }

  public render() {
    if (!this.state.failed) return this.props.children

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
          <p style={{ margin: 0, opacity: 0.72 }}>Euro 2028 Predictor</p>
          <h1 id="application-error-title">Something went wrong</h1>
          <p>
            Your account and predictions have not been changed. Reload the app to
            try again.
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
        </section>
      </main>
    )
  }
}
