import * as Sentry from '@sentry/react'
import {
  configureClientErrorReporter,
  type ClientErrorEvent,
  type ClientErrorReporter,
} from './clientObservability'
import { releaseIdentity, routeCategory } from './releaseIdentity'

const ALLOWED_SENTRY_INGEST_SUFFIXES = [
  '.ingest.sentry.io',
  '.ingest.us.sentry.io',
  '.ingest.de.sentry.io',
] as const

const CONTROLLED_EVENT_TAG = 'euro28_controlled_event'
const ALLOWED_ERROR_CONTEXTS = new Set([
  'trace',
  'euro28_release',
  'euro28_client_observability',
])
const ALLOWED_ERROR_TAGS = new Set([
  CONTROLLED_EVENT_TAG,
  'source',
  'route_category',
  'application_contract',
  'hosted_contract',
  'supabase_project_ref',
])

interface SanitizableSentryEvent {
  tags?: Record<string, string | number | boolean | undefined>
  contexts?: Record<string, unknown>
  user?: unknown
  request?: unknown
  breadcrumbs?: unknown[]
  extra?: Record<string, unknown>
  spans?: unknown[]
  transaction?: string
}

interface ValidatedSentryDsn {
  readonly dsn: string
  readonly ingestOrigin: string
}

export function configureSentryReporterFromEnvironment(): boolean {
  if (import.meta.env.VITE_SENTRY_ENABLED !== 'true') return false

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) {
    warnInDevelopment('VITE_SENTRY_ENABLED=true but VITE_SENTRY_DSN is missing.')
    return false
  }

  let validated: ValidatedSentryDsn
  try {
    validated = parseSentryDsn(dsn)
  } catch {
    warnInDevelopment('Sentry reporting is disabled because the DSN is invalid.')
    return false
  }

  Sentry.init({
    dsn: validated.dsn,
    enabled: true,
    environment: releaseIdentity.environment,
    release: `${releaseIdentity.application}@${releaseIdentity.commit}`,
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [
      Sentry.browserTracingIntegration({
        traceFetch: false,
        traceXHR: false,
        enableHTTPTimings: false,
        enableLongTask: false,
        enableLongAnimationFrame: false,
        ignoreResourceSpans: [
          'resource.script',
          'resource.css',
          'resource.img',
          'resource.other',
        ],
        linkPreviousTrace: 'off',
        beforeStartSpan(options) {
          return {
            ...options,
            name: routeCategory(currentPathname()),
          }
        },
      }),
    ],
    tracesSampleRate: releaseIdentity.environment === 'production' ? 0.1 : 1,
    tracePropagationTargets: [],
    maxBreadcrumbs: 0,
    beforeBreadcrumb() {
      return null
    },
    beforeSend(event) {
      return sanitiseSentryErrorEvent(event)
    },
    beforeSendTransaction(event) {
      return sanitiseSentryTransaction(event)
    },
  })

  configureClientErrorReporter(createSentryClientErrorReporter())
  return true
}

export function createSentryClientErrorReporter(
  capture: (error: Error, event: ClientErrorEvent) => void = captureWithSentrySdk,
): ClientErrorReporter {
  return (event) => {
    const error = new Error(event.error.message)
    error.name = event.error.name
    if (event.error.stack) error.stack = event.error.stack
    capture(error, event)
  }
}

export function parseSentryDsn(dsn: string): ValidatedSentryDsn {
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
  const projectId = pathSegments.at(-1)
  if (!projectId || !/^\d+$/.test(projectId)) {
    throw new Error('Sentry DSN must end with a numeric project ID.')
  }

  return {
    dsn: url.toString(),
    ingestOrigin: url.origin,
  }
}

export function sanitiseSentryErrorEvent<T extends SanitizableSentryEvent>(
  event: T,
): T | null {
  if (event.tags?.[CONTROLLED_EVENT_TAG] !== 'true') return null

  removeCommonUnsafeFields(event)
  filterRecord(event.tags, ALLOWED_ERROR_TAGS)
  filterRecord(event.contexts, ALLOWED_ERROR_CONTEXTS)
  return event
}

export function sanitiseSentryTransaction<T extends SanitizableSentryEvent>(
  event: T,
): T {
  removeCommonUnsafeFields(event)
  event.transaction = routeCategory(currentPathname())
  event.spans = []
  event.tags = {
    route_category: event.transaction,
    application_contract: String(releaseIdentity.applicationContract),
    hosted_contract:
      releaseIdentity.hostedContract === null
        ? 'unknown'
        : String(releaseIdentity.hostedContract),
    supabase_project_ref: releaseIdentity.supabaseProjectRef ?? 'unknown',
  }
  filterRecord(event.contexts, new Set(['trace']))
  return event
}

function captureWithSentrySdk(error: Error, event: ClientErrorEvent): void {
  Sentry.withScope((scope) => {
    scope.setUser(null)
    scope.clearBreadcrumbs()
    scope.setLevel('error')
    scope.setTag(CONTROLLED_EVENT_TAG, 'true')
    scope.setTag('source', event.source)
    scope.setTag('route_category', event.routeCategory)
    scope.setTag(
      'application_contract',
      String(event.release.applicationContract),
    )
    scope.setTag(
      'hosted_contract',
      event.release.hostedContract === null
        ? 'unknown'
        : String(event.release.hostedContract),
    )
    scope.setTag(
      'supabase_project_ref',
      event.release.supabaseProjectRef ?? 'unknown',
    )
    scope.setContext('euro28_release', {
      application: event.release.application,
      environment: event.release.environment,
      commit: event.release.commit,
      deploy_id: event.release.deployId,
      application_contract: event.release.applicationContract,
      hosted_contract: event.release.hostedContract,
      supabase_project_ref: event.release.supabaseProjectRef,
    })
    scope.setContext('euro28_client_observability', {
      schema_version: event.schemaVersion,
      source_event_id: event.eventId,
    })
    scope.setExtra('redacted_component_stack', event.error.componentStack)
    Sentry.captureException(error)
  })
}

function removeCommonUnsafeFields(event: SanitizableSentryEvent): void {
  delete event.user
  delete event.request
  delete event.breadcrumbs

  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (key !== 'redacted_component_stack') delete event.extra[key]
    }
  }
}

function filterRecord(
  record: Record<string, unknown> | undefined,
  allowedKeys: ReadonlySet<string>,
): void {
  if (!record) return
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) delete record[key]
  }
}

function isAllowedSentryIngestHost(hostname: string): boolean {
  return ALLOWED_SENTRY_INGEST_SUFFIXES.some((suffix) =>
    hostname.endsWith(suffix),
  )
}

function currentPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

function warnInDevelopment(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[sentry reporter] ${message}`)
  }
}
