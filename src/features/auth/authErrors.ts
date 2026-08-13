// Maps auth failures to friendly, user-facing copy. Pure and dependency-free so
// it can be unit-tested: data in (an unknown error), a string out. Screens show
// only the return value — a raw Supabase message must never reach the user
// (docs/auth-plan.md §3).

export type AuthAction = 'login' | 'signup' | 'reset' | 'update'

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
const CAPTCHA = 'The security check failed or expired. Please complete it again and retry.'
const GENERIC = 'Something went wrong. Please try again.'

/** Turn any thrown auth error into one stable, safe sentence. */
export function friendlyAuthError(error: unknown, action: AuthAction): string {
  const e = readError(error)
  if (isNetworkError(e)) return NETWORK

  const code = asText(e.code)
  const message = asText(e.message)

  // Supabase reports a rejected Turnstile token as `captcha_failed`; depending
  // on client/version the message can instead carry its Siteverify wording.
  // Do not make a valid password look wrong and do not expose provider internals.
  if (
    code === 'captcha_failed' ||
    message.includes('captcha protection') ||
    message.includes('invalid-input-response') ||
    message.includes('captcha verification')
  ) {
    return CAPTCHA
  }

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered')
  ) {
    return 'An account with this email already exists. Try logging in instead.'
  }

  if (
    action === 'login' &&
    (code === 'invalid_credentials' || message.includes('invalid login credentials'))
  ) {
    return "That email or password isn't right. Please try again."
  }

  if (code === 'weak_password' || message.includes('password should be at least')) {
    return 'Please choose a longer password (at least 6 characters).'
  }

  if (code === 'same_password' || message.includes('should be different from the old')) {
    return 'Your new password must be different from your current one.'
  }

  if (
    action === 'update' &&
    (code === 'session_not_found' ||
      asText(e.name) === 'authsessionmissingerror' ||
      message.includes('auth session missing') ||
      message.includes('session_not_found'))
  ) {
    return 'Your reset link has expired or was already used. Please request a new one.'
  }

  if (code === 'validation_failed' && message.includes('email')) {
    return 'Please enter a valid email address.'
  }

  if (message.includes('display name not allowed')) {
    return 'That display name isn’t available. Please choose another.'
  }

  if (
    action === 'signup' &&
    (code === 'pt429' ||
      message.includes('public registration is currently full') ||
      message.includes('public_signup_full'))
  ) {
    return 'Registration is currently full. Contact admin.'
  }

  // Supabase Auth may deliberately wrap a trigger rejection as an unexpected
  // database failure. The capacity preflight normally gives the exact full
  // state; this fallback remains accurate without exposing or guessing internals.
  if (
    action === 'signup' &&
    (code === 'unexpected_failure' ||
      message.includes('database error saving new user') ||
      message.includes('database error creating new user'))
  ) {
    return "We couldn't complete registration. Contact admin."
  }

  if (code === 'over_request_rate_limit' || Number(e.status) === 429) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  if (
    code === '42501' ||
    code === 'insufficient_privilege' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return "We couldn't finish setting up your account. Please try again."
  }

  return GENERIC
}
