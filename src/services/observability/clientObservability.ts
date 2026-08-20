import { releaseIdentity, routeCategory } from './releaseIdentity'

export type ClientErrorSource =
  | 'react'
  | 'window-error'
  | 'unhandled-rejection'
  | 'startup'
  /**
   * A Content-Security-Policy violation, reported so a REPORT-ONLY policy can
   * be measured against real traffic before it is enforced. See
   * `installCspViolationCapture`.
   */
  | 'csp-violation'
  /**
   * A competitive action that failed and was CAUGHT — a prediction save, a
   * Joker, a Last Man Standing pick, a join. These reach neither
   * `window.onerror` nor an unhandled rejection, so without their own source
   * they were invisible. See `operationFailure.ts`.
   */
  | 'operation-failure'

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
  const containsDatabaseDetail = DATABASE_ERROR_PATTERN.test(error.message)

  return {
    name: sanitiseText(error.name || 'Error', 80),
    message: containsDatabaseDetail
      ? 'A database operation failed.'
      : sanitiseText(error.message || 'Unexpected client error.', 500),
    stack: containsDatabaseDetail ? null : sanitiseStack(error.stack),
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
  const removeCspCapture = installCspViolationCapture()

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
    removeCspCapture()
  }
}

/**
 * `SEC-002` — what a report-only Content-Security-Policy actually found.
 *
 * WHY THIS EXISTS. `netlify.toml` now serves a REPORT-ONLY policy alongside the
 * enforced one, tightened where the enforced one is relaxed. A report-only
 * policy that nobody collects is a header with no reader, so the violations it
 * raises are routed into the observability the application already has rather
 * than to a second endpoint or a second stack.
 *
 * WHAT IS SENT, AND WHAT IS DELIBERATELY NOT. The directive, the blocked URI
 * and the source location — all of them either policy text or same-origin asset
 * URLs. `event.sample` is NOT sent and the policy does not ask for it:
 * `report-sample` would attach the first characters of the offending content,
 * and there is no rule that a page's inline content cannot contain something a
 * player typed. The whole point of this control is to find out whether the
 * application needs an exemption, which the directive alone answers.
 *
 * ONE REPORT PER DIRECTIVE PER PAGE. A violating rule usually violates on every
 * element it touches; a list that repeats the same finding two hundred times is
 * a bill rather than a signal.
 */
export function installCspViolationCapture(): () => void {
  if (typeof document === 'undefined') return () => {}

  const seen = new Set<string>()
  const handleViolation = (event: SecurityPolicyViolationEvent) => {
    // The enforced policy blocking something is a real failure and is reported
    // by whatever broke. This capture exists for the report-only policy, which
    // by definition breaks nothing and would otherwise be invisible.
    if (event.disposition !== 'report') return

    const key = `${event.effectiveDirective}|${event.blockedURI}`
    if (seen.has(key)) return
    seen.add(key)

    reportClientError(
      new Error(
        `Report-only CSP violation: ${event.effectiveDirective} blocked ` +
          `${event.blockedURI || 'inline'} (${event.sourceFile || 'unknown source'})`,
      ),
      'csp-violation',
    )
  }

  document.addEventListener('securitypolicyviolation', handleViolation)
  return () => {
    document.removeEventListener('securitypolicyviolation', handleViolation)
  }
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

/** A UUID in its own path segment — every player, league and fixture id here. */
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A bare numeric id. Two digits or more, so `/v1` and `/v2` survive. */
const NUMERIC_SEGMENT = /^\d{2,}$/
/** A long hex digest: a content hash, a token, a raw key. */
const HEX_SEGMENT = /^[0-9a-f]{16,}$/i

/**
 * Whether a path segment looks like an opaque identifier rather than a name.
 *
 * The mixed-alphanumeric rule needs both a digit and a letter, so a readable
 * route or RPC name survives — `admin_ai_dashboard` is eighteen characters and
 * carries no digit, and losing it would make a Supabase failure much harder to
 * read for no privacy gain.
 */
function isIdentifierSegment(segment: string): boolean {
  if (UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment) || HEX_SEGMENT.test(segment)) {
    return true
  }
  return segment.length >= 16 && /\d/.test(segment) && /[A-Za-z]/.test(segment)
}

function redactIdentifierSegments(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (isIdentifierSegment(segment) ? '[id]' : segment))
    .join('/')
}

/**
 * A URL reduced to something safe to send to a third party.
 *
 * IT USED TO RETURN `origin + pathname` VERBATIM, and the pathname is where this
 * application keeps its secrets. `/join/<invite-code>` is the whole invite:
 * contract 152 hardened the generator precisely because possession of a code is
 * what gets someone into a private league. `/league/<id>`, `/h2h/<rivalId>` and
 * `/tournament/profile/<playerId>` are identifiers for real people and groups.
 * Query strings, hashes, emails, JWTs and database credentials were already
 * stripped, so the path was the one place a live value still travelled — and it
 * travelled from any error message or stack line that happened to quote a URL.
 *
 * AN INVITE CODE CANNOT BE RECOGNISED STRUCTURALLY, which decides the approach.
 * It is six or more upper-case alphanumerics, so it is indistinguishable from an
 * ordinary path word like `SCORING`; no heuristic can separate them. So known
 * application routes are replaced wholesale by the category `routeCategory`
 * already computes for telemetry — `/join/ABC123` becomes `/[invite]` — which
 * cannot carry a value because the category vocabulary is a fixed closed set.
 *
 * Anything `routeCategory` does not recognise is not one of our routes: a
 * Supabase endpoint, a CDN asset, a third-party script. Those keep their shape
 * with identifier-looking segments redacted, because a readable
 * `/rest/v1/rpc/<name>` is worth a great deal when reading a remote error and
 * gives nothing away.
 */
function sanitiseUrl(value: string): string {
  try {
    const url = new URL(value)
    const category = routeCategory(url.pathname)
    const path = category === 'unknown' ? redactIdentifierSegments(url.pathname) : `/[${category}]`
    return `${url.origin}${path}`
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
