// Auth query wrappers. Everything auth-related the app needs goes through here
// so nothing outside src/services/supabase/ touches the Supabase client.

import type { Session } from '@supabase/supabase-js'
import { supabase } from './client'

export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

/** Subscribe to session changes; returns an unsubscribe function. */
export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
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
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    ...(captchaToken ? { options: { captchaToken } } : {}),
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
  captchaToken?: string
}): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
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

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
