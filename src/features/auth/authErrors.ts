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

  // Wrong email/password — this copy only makes sense on login; on sign-up an
  // "invalid credentials" code is anomalous, so fall through to generic.
  if (
    action === 'login' &&
    (code === 'invalid_credentials' || message.includes('invalid login credentials'))
  ) {
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

  // Display name rejected by the server moderation trigger (evasion of the
  // client check). Don't echo which rule tripped.
  if (message.includes('display name not allowed')) {
    return 'That display name isn’t available. Please choose another.'
  }

  // Too many attempts.
  if (code === 'over_request_rate_limit' || Number(e.status) === 429) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  // A permission / no-session failure (e.g. a row-level-security rejection —
  // the shape of the 2026-07-20 incident, when confirmation left sign-up with no
  // session and the client profile insert was rejected). This is NOT an
  // email-already-in-use case, so it must get its own accurate copy rather than
  // the old fallback that guessed "email may already be in use". Profile
  // creation is now a server-side trigger, so this is a defensive branch.
  if (
    code === '42501' ||
    code === 'insufficient_privilege' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return "We couldn't finish setting up your account. Please try again."
  }

  // Unknown failure: a plain generic message for BOTH actions. Deliberately no
  // "the email may already be in use" hint — the genuine email-in-use case is
  // handled explicitly above; guessing it here mislabels unrelated failures.
  return GENERIC
}
