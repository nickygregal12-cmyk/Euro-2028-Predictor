import { createClient } from '@supabase/supabase-js'

const DEFAULT_EMAIL = 'e2e@euro28.local'
const DEFAULT_PASSWORD = 'E2e-local-only-2028!'
const LOCAL_SUPABASE_PORT = '54321'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Browser E2E requires ${name}.`)
  return value
}

export default async function globalSetup() {
  const url = required('E2E_SUPABASE_URL')
  const serviceRoleKey = required('E2E_SUPABASE_SERVICE_ROLE_KEY')
  const email = process.env.E2E_USER_EMAIL?.trim() || DEFAULT_EMAIL
  const password = process.env.E2E_USER_PASSWORD || DEFAULT_PASSWORD

  const parsed = new URL(url)
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.port !== LOCAL_SUPABASE_PORT
  ) {
    throw new Error(
      `Browser E2E refuses non-standard local Supabase URL ${parsed.origin}.`,
    )
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // The hardened write/delete functions fail closed when the tournament has no
  // lock boundary. The provisional seed intentionally omits one, so browser E2E
  // configures a future lock only inside the disposable local database.
  const { data: tournaments, error: tournamentReadError } = await admin
    .from('tournaments')
    .select('id')
    .limit(1)
  if (tournamentReadError) throw tournamentReadError
  const tournamentId = tournaments?.[0]?.id
  if (!tournamentId) throw new Error('Browser E2E found no seeded tournament.')

  const futureLock = new Date()
  futureLock.setUTCFullYear(futureLock.getUTCFullYear() + 10)
  const { error: tournamentUpdateError } = await admin
    .from('tournaments')
    .update({ lock_at: futureLock.toISOString() })
    .eq('id', tournamentId)
  if (tournamentUpdateError) throw tournamentUpdateError

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError

  const existing = listed.users.find((user) => user.email === email)
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id)
    if (error) throw error
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) throw createError
  if (!created.user) throw new Error('Local E2E user creation returned no user.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: 'E2E Tester',
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError
}
