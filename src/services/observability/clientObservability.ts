import { releaseIdentity, routeCategory } from './releaseIdentity'

export type ClientErrorSource =
  | 'react'
  | 'window-error'
  | 'unhandled-rejection'
  | 'startup'

export interface SafeClientError {
  readonly name: string
  readonly message: string
  readonly stack: string | null
  readonly componentStack: string | null
}

export interface ClientErrorEvent {
  readonly schemaVersion: 1
  readonly eventId: string
  readonly occurredAt: string
  readonly source: ClientErrorSource
  readonly routeCategory: string
  readonly release: typeof releaseIdentity
  readonly error: SafeClientError
}

export type ClientErrorReporter = (
  event: ClientErrorEvent,
) => void | Promise<void>

let activeReporter: ClientErrorReporter | null = null

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
const LOCAL_PATH_PATTERN = /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[^\s)]+/gi
const DATABASE_ERROR_PATTERN =
  /(?:SQLSTATE|PostgREST|duplicate key|violates (?:foreign key|unique|check)|relation ["'][^"']+["']|column ["'][^"']+["'])/i

export function configureClientErrorReporter(
  reporter: ClientErrorReporter | null,
): () => void {
  const previous = activeReporter
  activeReporter = reporter

  return () => {
    activeReporter = previous
  }
}

export function normaliseClientError(
  value: unknown,
  componentStack?: string | null,
): SafeClientError {
  const error = value instanceof Error ? value : new Error(toSafeString(value))

  return {
    name: sanitiseText(error.name || 'Error', 80),
    message: sanitiseErrorMessage(error.message),
    stack: sanitiseStack(error.stack),
    componentStack: sanitiseStack(componentStack),
  }
}

export function reportClientError(
  value: unknown,
  source: ClientErrorSource,
  pathname = currentPathname(),
  componentStack?: string | null,
): ClientErrorEvent {
  const event: ClientErrorEvent = {
    schemaVersion: 1,
    eventId: createEventId(),
    occurredAt: new Date().toISOString(),
    source,
    routeCategory: routeCategory(pathname),
    release: releaseIdentity,
    error: normaliseClientError(value, componentStack),
  }

  if (!activeReporter) {
    if (import.meta.env.DEV) {
      console.error('[client-observability disabled]', event)
    }
    return event
  }

  try {
    const result = activeReporter(event)
    if (result instanceof Promise) {
      void result.catch(() => {
        if (import.meta.env.DEV) {
          console.error('[client-observability reporter failed]')
        }
      })
    }
  } catch {
    if (import.meta.env.DEV) {
      console.error('[client-observability reporter failed]')
    }
  }

  return event
}

export function installGlobalErrorCapture(): () => void {
  const handleError = (event: ErrorEvent) => {
    reportClientError(
      event.error ?? new Error(event.message || 'Unhandled window error'),
      'window-error',
    )
  }

  const handleRejection = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason, 'unhandled-rejection')
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}

function sanitiseErrorMessage(value: string): string {
  if (DATABASE_ERROR_PATTERN.test(value)) {
    return 'A database operation failed.'
  }

  return sanitiseText(value || 'Unexpected client error.', 500)
}

function sanitiseStack(value?: string | null): string | null {
  if (!value) return null

  const lines = value
    .split('\n')
    .slice(0, 12)
    .map((line) => sanitiseText(line, 300))
    .filter(Boolean)

  return lines.length > 0 ? lines.join('\n').slice(0, 2_000) : null
}

function sanitiseText(value: string, maximumLength: number): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(BEARER_PATTERN, 'Bearer [redacted-token]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(LOCAL_PATH_PATTERN, '[redacted-local-path]')
    .replace(/https?:\/\/[^\s)]+/gi, sanitiseUrl)
    .slice(0, maximumLength)
}

function sanitiseUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return '[redacted-url]'
  }
}

function toSafeString(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value)
    default:
      return 'Unexpected client error.'
  }
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function currentPathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}
