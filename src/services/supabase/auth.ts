// Auth query wrappers. Everything auth-related the app needs goes through here
// so nothing outside src/services/supabase/ touches the Supabase client.

import type { Session } from '@supabase/supabase-js'
import { supabase } from './client'
import { createMyProfile } from './profile'

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

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/**
 * Sign up with email + password and create the matching profiles row.
 *
 * v0.1 dev projects have email confirmation disabled, so sign-up returns a live
 * session and `auth.uid()` is set — which is what lets the profile insert pass
 * RLS. If a project ever enables confirmation there'd be no session here and the
 * profile insert would fail; that's a Phase 2 concern (password reset / email
 * confirmation) and out of scope for v0.1.
 */
export async function signUpWithPassword(params: {
  email: string
  password: string
  displayName: string
}): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
  })
  if (error) throw error
  const userId = data.user?.id
  if (!userId) {
    // No user id means sign-up didn't complete as expected (e.g. confirmation
    // required). Surface it as a generic failure rather than silently skipping
    // profile creation.
    throw new Error('Sign-up did not return a user.')
  }
  await createMyProfile(userId, params.displayName)
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
