// The single Supabase client for the whole app.
//
// ARCHITECTURE RULE: nothing outside `src/services/supabase/` may import this
// client (or `@supabase/supabase-js`) directly. All database access goes
// through query wrappers in this folder, so there is exactly one place that
// talks to Supabase (see CLAUDE.md).
//
// Fail-closed: if either env var is missing we throw at startup rather than
// letting the app run against an undefined backend.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local (see .env.example / project setup).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
