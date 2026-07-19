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

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
