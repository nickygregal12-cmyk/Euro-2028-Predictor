type ErrorShape = {
  code?: unknown
  status?: unknown
  message?: unknown
  name?: unknown
}

function readError(error: unknown): ErrorShape {
  if (typeof error === 'object' && error !== null) return error as ErrorShape
  if (typeof error === 'string') return { message: error }
  return {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

const NETWORK = "We couldn't reach the server. Check your connection and try again."
const SESSION = 'Your session has expired. Please sign in again.'
const PERMISSION = "You don't have permission to do that."
const CONFLICT = 'This information changed elsewhere. Refresh and try again.'
const RATE_LIMIT = 'Too many attempts. Please wait a moment and try again.'
const GENERIC = 'Something went wrong. Please try again.'

/**
 * Maps unknown infrastructure failures to stable user-facing copy. Raw database,
 * RPC and network details must never be returned. A caller may provide a more
 * useful operation-specific fallback, but it must itself be safe static copy.
 */
export function userFacingError(error: unknown, fallback = GENERIC): string {
  const e = readError(error)
  const code = text(e.code)
  const message = text(e.message)
  const name = text(e.name)
  const status = Number(e.status)

  if (
    name === 'typeerror' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  ) {
    return NETWORK
  }

  if (
    status === 401 ||
    code === '401' ||
    code === 'pgrst301' ||
    code === 'session_not_found' ||
    message.includes('jwt expired') ||
    message.includes('invalid jwt') ||
    message.includes('auth session missing')
  ) {
    return SESSION
  }

  if (status === 429 || code === '429' || code === 'over_request_rate_limit') {
    return RATE_LIMIT
  }

  if (
    code === 'pt409' ||
    code === '23505' ||
    status === 409 ||
    message.includes('version conflict') ||
    message.includes('changed elsewhere')
  ) {
    return CONFLICT
  }

  if (
    status === 403 ||
    code === '42501' ||
    code === 'insufficient_privilege' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return PERMISSION
  }

  return fallback
}
