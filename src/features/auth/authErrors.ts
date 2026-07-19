// Maps auth failures to friendly, user-facing copy. Pure and dependency-free so
// it can be unit-tested: data in (an unknown error), a string out. Screens show
// only the return value — a raw Supabase message must never reach the user
// (docs/auth-plan.md §3).

export type AuthAction = 'login' | 'signup'

// Supabase surfaces failures either as AuthError (with a `code` and HTTP
// `status`) or, when the network is down, as a plain TypeError from fetch. We
// read whatever fields are present without importing Supabase types.
type MaybeError = {
  code?: unknown
  status?: unknown
  message?: unknown
  name?: unknown
}

function readError(error: unknown): MaybeError {
  if (typeof error === 'object' && error !== null) return error as MaybeError
  if (typeof error === 'string') return { message: error }
  return {}
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

// A dropped connection shows up as a TypeError ("Failed to fetch" /
// "NetworkError" / "Load failed") with no HTTP status.
function isNetworkError(e: MaybeError): boolean {
  const message = asText(e.message)
  if (asText(e.name) === 'typeerror') return true
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  )
}

const NETWORK =
  "We couldn't reach the server. Check your connection and try again."
const GENERIC = 'Something went wrong. Please try again.'

/**
 * Turn any thrown auth error into a single friendly sentence. `action` tailors
 * the copy: the same "invalid credentials" code means different things on the
 * login and sign-up screens.
 */
export function friendlyAuthError(error: unknown, action: AuthAction): string {
  const e = readError(error)
  if (isNetworkError(e)) return NETWORK

  const code = asText(e.code)
  const message = asText(e.message)

  // Existing account (sign-up).
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered')
  ) {
    return 'An account with this email already exists. Try logging in instead.'
  }

  // Wrong email/password (login).
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return "That email or password isn't right. Please try again."
  }

  // Weak password (sign-up) — Supabase enforces a minimum length.
  if (code === 'weak_password' || message.includes('password should be at least')) {
    return 'Please choose a longer password (at least 6 characters).'
  }

  // Malformed email.
  if (code === 'validation_failed' && message.includes('email')) {
    return 'Please enter a valid email address.'
  }

  // Too many attempts.
  if (code === 'over_request_rate_limit' || Number(e.status) === 429) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  return action === 'signup'
    ? `${GENERIC} If this keeps happening, the email may already be in use.`
    : GENERIC
}
