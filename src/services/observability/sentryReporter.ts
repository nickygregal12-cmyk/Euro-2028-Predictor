import {
  configureClientErrorReporter,
  type ClientErrorEvent,
  type ClientErrorReporter,
} from './clientObservability'

const SENTRY_CLIENT = 'euro28-predictor/1.0'
const ALLOWED_SENTRY_INGEST_SUFFIXES = [
  '.ingest.sentry.io',
  '.ingest.us.sentry.io',
  '.ingest.de.sentry.io',
] as const

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

interface SentryTransportTarget {
  readonly envelopeUrl: string
}

export function configureSentryReporterFromEnvironment(): boolean {
  if (import.meta.env.VITE_SENTRY_ENABLED !== 'true') return false

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) {
    warnInDevelopment('VITE_SENTRY_ENABLED=true but VITE_SENTRY_DSN is missing.')
    return false
  }

  try {
    configureClientErrorReporter(createSentryClientErrorReporter(dsn))
    return true
  } catch {
    warnInDevelopment('Sentry reporting is disabled because the DSN is invalid.')
    return false
  }
}

export function createSentryClientErrorReporter(
  dsn: string,
  fetchImplementation: FetchLike = fetch,
): ClientErrorReporter {
  const target = parseSentryDsn(dsn)

  return async (event) => {
    const response = await fetchImplementation(target.envelopeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
      },
      body: createEnvelope(event),
      credentials: 'omit',
      keepalive: true,
      mode: 'cors',
      referrerPolicy: 'no-referrer',
    })

    if (!response.ok) {
      throw new Error(`Sentry delivery failed with HTTP ${response.status}.`)
    }
  }
}

export function parseSentryDsn(dsn: string): SentryTransportTarget {
  let url: URL
  try {
    url = new URL(dsn)
  } catch {
    throw new Error('Sentry DSN must be a valid URL.')
  }

  if (
    url.protocol !== 'https:' ||
    !url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Sentry DSN must be a public HTTPS browser DSN.')
  }

  if (!isAllowedSentryIngestHost(url.hostname)) {
    throw new Error('Only approved Sentry cloud ingest hosts are supported.')
  }

  const pathSegments = url.pathname.split('/').filter(Boolean)
  const projectId = pathSegments.pop()
  if (!projectId || !/^\d+$/.test(projectId)) {
    throw new Error('Sentry DSN must end with a numeric project ID.')
  }

  const pathPrefix = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : ''
  const envelopeUrl = new URL(
    `${pathPrefix}/api/${projectId}/envelope/`,
    url.origin,
  )
  envelopeUrl.searchParams.set('sentry_key', url.username)
  envelopeUrl.searchParams.set('sentry_version', '7')
  envelopeUrl.searchParams.set('sentry_client', SENTRY_CLIENT)

  return { envelopeUrl: envelopeUrl.toString() }
}

function createEnvelope(event: ClientErrorEvent): string {
  const eventId = toSentryEventId(event.eventId)
  const payload = {
    event_id: eventId,
    timestamp: event.occurredAt,
    platform: 'javascript',
    level: 'error',
    environment: event.release.environment,
    release: `${event.release.application}@${event.release.commit}`,
    tags: {
      source: event.source,
      route_category: event.routeCategory,
      application_contract: String(event.release.applicationContract),
      hosted_contract:
        event.release.hostedContract === null
          ? 'unknown'
          : String(event.release.hostedContract),
      supabase_project_ref: event.release.supabaseProjectRef ?? 'unknown',
    },
    exception: {
      values: [
        {
          type: event.error.name,
          value: event.error.message,
          mechanism: {
            type: `euro28.${event.source}`,
            handled: event.source === 'react' || event.source === 'startup',
          },
        },
      ],
    },
    contexts: {
      release: {
        type: 'euro28_release',
        application: event.release.application,
        environment: event.release.environment,
        commit: event.release.commit,
        deploy_id: event.release.deployId,
        application_contract: event.release.applicationContract,
        hosted_contract: event.release.hostedContract,
        supabase_project_ref: event.release.supabaseProjectRef,
      },
      client_observability: {
        type: 'euro28_client_observability',
        schema_version: event.schemaVersion,
        source_event_id: event.eventId,
      },
    },
    extra: {
      redacted_stack: event.error.stack,
      redacted_component_stack: event.error.componentStack,
    },
  }

  return [
    JSON.stringify({ event_id: eventId, sent_at: event.occurredAt }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(payload),
  ].join('\n')
}

function toSentryEventId(value: string): string {
  const hexadecimal = value.replace(/[^a-f0-9]/gi, '').toLowerCase()
  return `${hexadecimal}${'0'.repeat(32)}`.slice(0, 32)
}

function isAllowedSentryIngestHost(hostname: string): boolean {
  return ALLOWED_SENTRY_INGEST_SUFFIXES.some((suffix) =>
    hostname.endsWith(suffix),
  )
}

function warnInDevelopment(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[sentry reporter] ${message}`)
  }
}
