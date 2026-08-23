// Auth query wrappers. Everything auth-related the app needs goes through here
// so nothing outside src/services/supabase/ touches the Supabase client.

import type { Session } from '@supabase/supabase-js'
import { db } from './client'

export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await db.auth.getSession()
  return session
}

/** Subscribe to session changes; returns an unsubscribe function. */
export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = db.auth.onAuthStateChange((_event, session) => callback(session))
  return () => subscription.unsubscribe()
}

export async function signInWithPassword(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<void> {
  // captchaToken is passed only when Turnstile is enabled; Supabase runs
  // siteverify with its configured secret (Option A). Omitted otherwise so a
  // project without CAPTCHA isn't sent an unexpected token.
  const { error } = await db.auth.signInWithPassword({
    email,
    password,
    ...(captchaToken ? { options: { captchaToken } } : {}),
  })
  if (error) throw error
}

/**
 * Start the supported Supabase Google OAuth flow.
 *
 * GOOGLE AUTHENTICATES; IT DOES NOT CHOOSE THE PUBLIC FOOTBALL NAME. The
 * on-auth-user trigger deliberately ignores Google full-name/avatar metadata and
 * creates the neutral `Player` fallback when no app-owned display_name exists.
 * `/welcome` then requires the player to choose their public name before the
 * rest of onboarding can be completed.
 *
 * The callback returns to this deployment's origin. Supabase must allow-list the
 * origin and the Google provider must be enabled in the hosted project before a
 * build enables the Google CTA; those are hosted configuration gates, not a
 * reason to put provider credentials in browser code.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

/**
 * Sign up with email + password. The matching `profiles` row is created
 * SERVER-SIDE by the `on_auth_user_created` trigger (20260720190000), reading
 * the display name from the sign-up metadata below — so it works whether or not
 * sign-up returns a session (confirmation off or on), with no client insert to
 * race `auth.uid()` (the 2026-07-20 incident fix).
 *
 * Returns whether email confirmation is pending: with confirmation OFF (current
 * dev setting) sign-up returns a session and `needsConfirmation` is false; if a
 * project enables confirmation, there's no session and the caller shows a
 * "check your email" state instead of treating it as a failure.
 */
export async function signUpWithPassword(params: {
  email: string
  password: string
  displayName: string
  captchaToken?: string | undefined
}): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await db.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: { display_name: params.displayName.trim() },
      ...(params.captchaToken ? { captchaToken: params.captchaToken } : {}),
    },
  })
  if (error) throw error
  if (!data.user) throw new Error('Sign-up did not return a user.')
  return { needsConfirmation: data.session === null }
}

/**
 * Send a password-reset email. Supabase deliberately does NOT reveal whether the
 * address has an account (email-enumeration protection), so this resolves without
 * error for unknown emails — the caller always shows the same neutral "if an
 * account exists" copy. The link in the email lands the user on
 * `/auth/update-password` (via `redirectTo`), where Supabase's recovery session
 * lets them set a new password.
 *
 * captchaToken is passed only when Turnstile is enabled — Supabase's CAPTCHA
 * protection covers the recover endpoint too, so with CAPTCHA on a token is
 * required; omitted otherwise (Option A, mirrors signIn/signUp).
 */
export async function sendPasswordReset(email: string, captchaToken?: string): Promise<void> {
  const { error } = await db.auth.resetPasswordForEmail(email, {
    // Use the current origin so the link resolves on whichever domain the user
    // is on (euro28predictor.com or the netlify.app fallback). Both must be in
    // Supabase Auth → URL Configuration's redirect allow-list.
    redirectTo: `${window.location.origin}/auth/update-password`,
    ...(captchaToken ? { captchaToken } : {}),
  })
  if (error) throw error
}

/**
 * Set a new password for the currently-authenticated user. On the reset flow
 * this runs against the recovery session Supabase established from the email
 * link; it upgrades that into a normal session, so the user stays signed in.
 * Throws if there's no session (expired/!invalid link) — the page handles that.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await db.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await db.auth.signOut()
}

export type SessionEmailState = { email: string | null; pendingEmail: string | null }

/** The signed-in address plus any not-yet-confirmed replacement. */
export async function getSessionEmailState(): Promise<SessionEmailState> {
  const { data } = await db.auth.getSession()
  const user = data.session?.user ?? null
  return {
    email: user?.email ?? null,
    pendingEmail: (user as { new_email?: string } | null)?.new_email ?? null,
  }
}

/**
 * Change the account email. Supabase sends a confirmation to the new address;
 * the change applies only once that link is clicked.
 */
export async function updateEmail(newEmail: string): Promise<void> {
  const { error } = await db.auth.updateUser({ email: newEmail })
  if (error) throw error
}