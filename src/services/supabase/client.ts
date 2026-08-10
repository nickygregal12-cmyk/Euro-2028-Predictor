// The single Supabase client for the whole app.
//
// ARCHITECTURE RULE: nothing outside `src/services/supabase/` may import this
// client (or `@supabase/supabase-js`) directly. All database access goes
// through query wrappers in this folder, so there is exactly one place that
// talks to Supabase (see CLAUDE.md).
//
// Fail-closed: if either env var is missing we throw at startup rather than
// letting the app run against an undefined backend.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local (see .env.example / project setup).'
  )
}

// ONE client, generated types applied. Both exports below are this object.
const client = createClient<Database>(supabaseUrl, supabaseAnonKey)

/**
 * The typed client. Use this in new code and in anything being migrated.
 *
 * Every call through `db` is checked against `database.types.ts`, so a column
 * rename in a migration becomes a compile error instead of a runtime one. That
 * is the whole of `TYPE-001`.
 */
export const db = client

/**
 * The same client, with its schema types erased — for modules not yet
 * reconciled with the generated schema.
 *
 * WHY THIS EXISTS RATHER THAN JUST TYPING EVERYTHING AT ONCE. Applying
 * `Database` to the client surfaces every disagreement between the hand-written
 * models and the real schema simultaneously: 27 of them, across 17 modules,
 * measured. Some are genuine defects, and some are the generated types being
 * unable to see a trigger — they want opposite fixes, and several need a SQL
 * signature checked before the fix is even knowable. Landing that as one change
 * would be unreviewable, and reviewing it badly is how a "type safety" pull
 * request quietly changes what a query sends.
 *
 * So modules move one group at a time, and this export is what lets the rest
 * keep compiling meanwhile. `databaseTypeMigration.test.ts` records which
 * modules have moved and refuses to let one move back.
 *
 * IT IS NOT A CAST, and that is deliberate. `SupabaseClient<Database>` is
 * assignable to `SupabaseClient` on its own, so this widening is checked by the
 * compiler rather than asserted past it. An `as` here would have been able to
 * hide a genuinely wrong client type.
 *
 * DELETE THIS EXPORT when the last module has moved. At that point `db` and
 * `supabase` are the same thing and the seam has served its purpose — the
 * migration test names the remaining modules so the finish line is countable.
 */
export const supabase: SupabaseClient = client
