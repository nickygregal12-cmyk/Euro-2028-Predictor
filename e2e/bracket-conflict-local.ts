import { createLocalAdmin, prepareCompleteGroupEntry, type PreparedEntry } from './local-supabase'

export const BRACKET_E2E_EMAIL = 'bracket-e2e@euro28.local'
export const BRACKET_E2E_PASSWORD = 'Bracket-local-only-2028!'

export type PreparedBracketConflictEntry = PreparedEntry & {
  email: string
  password: string
}

/**
 * Create a dedicated local-only account for the stateful two-device bracket
 * journey. The helper inherits createLocalAdmin's strict HTTP-loopback/54321
 * guard and temporarily points the existing deterministic group-entry fixture
 * at this account. Workers are fixed to one in CI, so the scoped env override
 * cannot race another fixture.
 */
export async function prepareBracketConflictEntry(): Promise<PreparedBracketConflictEntry> {
  const admin = createLocalAdmin()
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listError) throw listError

  const existing = listed.users.find((user) => user.email === BRACKET_E2E_EMAIL)
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id)
    if (error) throw error
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: BRACKET_E2E_EMAIL,
    password: BRACKET_E2E_PASSWORD,
    email_confirm: true,
  })
  if (createError) throw createError
  if (!created.user) throw new Error('Bracket browser E2E user creation returned no user.')

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    display_name: 'Bracket E2E Tester',
    welcomed_at: new Date().toISOString(),
  })
  if (profileError) throw profileError

  const previousEmail = process.env.E2E_USER_EMAIL
  process.env.E2E_USER_EMAIL = BRACKET_E2E_EMAIL
  try {
    const prepared = await prepareCompleteGroupEntry()
    return {
      ...prepared,
      email: BRACKET_E2E_EMAIL,
      password: BRACKET_E2E_PASSWORD,
    }
  } finally {
    if (previousEmail === undefined) delete process.env.E2E_USER_EMAIL
    else process.env.E2E_USER_EMAIL = previousEmail
  }
}
