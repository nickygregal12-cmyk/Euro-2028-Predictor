// Client-side field checks for sign-up. Pure so it's unit-testable and shared
// between the form and its tests. These mirror the server constraints — the
// display_name length is also a DB check (1–40), and the password minimum is
// Supabase's default — so they're a friendly first line, never the only guard.

export const DISPLAY_NAME_MAX = 40
export const PASSWORD_MIN = 6

export type SignUpValues = {
  displayName: string
  email: string
  password: string
}

export type SignUpFieldErrors = {
  displayName?: string
  email?: string
  password?: string
}

// Deliberately permissive: real address validity is proven by sign-up
// succeeding. This only catches obviously-empty or malformed input early.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSignUp(values: SignUpValues): SignUpFieldErrors {
  const errors: SignUpFieldErrors = {}

  const name = values.displayName.trim()
  if (name.length === 0) {
    errors.displayName = 'Please choose a display name.'
  } else if (name.length > DISPLAY_NAME_MAX) {
    errors.displayName = `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`
  }

  const email = values.email.trim()
  if (email.length === 0) {
    errors.email = 'Please enter your email.'
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Please enter a valid email address.'
  }

  if (values.password.length < PASSWORD_MIN) {
    errors.password = `Password must be at least ${PASSWORD_MIN} characters.`
  }

  return errors
}

export function hasErrors(errors: SignUpFieldErrors): boolean {
  return Object.keys(errors).length > 0
}
