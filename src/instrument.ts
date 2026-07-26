import { reportClientError } from './services/observability/clientObservability'
import { releaseIdentity } from './services/observability/releaseIdentity'
import { configureSentryReporterFromEnvironment } from './services/observability/sentryReporter'

const sentryConfigured = configureSentryReporterFromEnvironment()

if (
  sentryConfigured &&
  import.meta.env.VITE_SENTRY_VERIFICATION_EVENT === 'true' &&
  releaseIdentity.environment !== 'production'
) {
  queueMicrotask(() => {
    reportClientError(
      new Error('Synthetic Sentry SDK verification event.'),
      'startup',
      '/__sentry-verification__',
    )
  })
}
