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
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local (see .env.example / project setup).'
  )
}

// ONE client, generated types applied — and only one export of it.
//
// Every call through `db` is checked against `database.types.ts`, so a column
// rename in a migration becomes a compile error instead of a runtime one. That
// is the whole of `TYPE-001`.
//
// THE SEAM IS GONE. Between AUD-10-b-i and AUD-10-b-ii this module exported the
// same client twice — `db` typed and `supabase` with its schema types erased —
// so the forty-six service modules could move across in groups instead of in
// one unreviewable change. All of them have moved, so the untyped export and
// the test that counted the remainder are both deleted. There is no longer a
// supported way to reach this client without its types.
export const db = createClient<Database>(supabaseUrl, supabaseAnonKey)
