import { createClient } from '@supabase/supabase-js'
import { SEED_IDENTITIES, seedIdentity, type SeedIdentity } from './seed-contract'

const ADMIN_IDENTITY = seedIdentity('admin')
const DEFAULT_EMAIL = ADMIN_IDENTITY.email
const DEFAULT_PASSWORD = ADMIN_IDENTITY.password
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

  /*
   * Provision the whole declared cast from `seed-contract.ts` rather than a
   * single inline identity (ADR 0024). The admin keeps the historical
   * credentials, so `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` overrides and every
   * existing spec resolve to the same account as before; the ordinary players
   * are additive and exist so multi-account journeys stop hand-rolling users.
   */
  async function provision(identity: SeedIdentity, overrides: { email?: string; password?: string } = {}) {
    const identityEmail = overrides.email ?? identity.email
    const identityPassword = overrides.password ?? identity.password

    const existing = listed.users.find((user) => user.email === identityEmail)
    if (existing) {
      const { error } = await admin.auth.admin.deleteUser(existing.id)
      if (error) throw error
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: identityEmail,
      password: identityPassword,
      email_confirm: true,
      app_metadata: {
        admin_capabilities: [...identity.adminCapabilities],
      },
    })
    if (createError) throw createError
    if (!created.user) {
      throw new Error(`Local E2E user creation returned no user for ${identity.key}.`)
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: created.user.id,
      display_name: identity.displayName,
      welcomed_at: new Date().toISOString(),
    })
    if (profileError) throw profileError

    return created.user.id
  }

  for (const identity of SEED_IDENTITIES) {
    // The admin honours the environment overrides; the rest are fixed so
    // specs can rely on them by name.
    await provision(
      identity,
      identity.key === 'admin' ? { email, password } : {},
    )
  }
}
